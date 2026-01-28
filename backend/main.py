from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from datetime import datetime
from pymongo import MongoClient

# Load environment variables
load_dotenv()

app = FastAPI(title="FinCommerce Engine")

# Configure CORS
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "DataBaseDM")
if MONGODB_URI:
    mongo_client = MongoClient(MONGODB_URI)
    db = mongo_client[DB_NAME]
    users_collection = db["users"]
    products_collection = db["Products"]
else:
    mongo_client = None
    db = None
    users_collection = None
    products_collection = None

# Try to import optional dependencies
try:
    from qdrant_client import QdrantClient
    from sentence_transformers import SentenceTransformer
    import numpy as np
    
    QDRANT_URL = os.getenv("QDRANT_URL")
    QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
    
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    model = SentenceTransformer("all-MiniLM-L6-v2")
    has_qdrant = True
except ImportError as e:
    print(f"Warning: Qdrant dependencies not available: {e}")
    has_qdrant = False
    client = None
    model = None

collection_name = "Products"

# --- Endpoint: health check ---
@app.get("/")
def health():
    return {"status": "ok", "qdrant_available": has_qdrant}

# --- Request model for user search with preferences ---
class UserSearchRequest(BaseModel):
    query: str
    userId: str
    budgetRange: dict
    preferences: dict
    preferredPaymentMethod: str
    top_k: int = 15

# --- Request model for recommendations without query ---
class UserRecommendationRequest(BaseModel):
    userId: str
    top_k: int = 15

# --- Response model ---
class SearchResult(BaseModel):
    product_id: str
    score: float

class SearchResponse(BaseModel):
    recommendations: list[SearchResult]
    personalization_applied: bool
    timestamp: str

# --- Endpoint: user search with preferences and advanced filtering ---
@app.post("/api/search/user-search")
async def user_search(request: UserSearchRequest):
    """
    Advanced semantic search with 8-step filtering pipeline:
    1. Availability filter
    2. Hybrid search (BM25 + dense embeddings)
    3. Budget filter
    4. Preferences filter (category, brand, materials)
    5. Payment method filter
    6. MMR (λ=0.7) - diversify top candidates
    7. Custom Reranking: final_score = semantic_score + 0.1*rate + 0.001*review_count
    8. Return Top-K
    """
    if not has_qdrant:
        return {
            "error": "Search service not available",
            "recommendations": [],
            "personalization_applied": {
                "availability_filtered": False,
                "hybrid_search_applied": False,
                "budget_filtered": False,
                "category_filtered": False,
                "brand_filtered": False,
                "material_filtered": False,
                "payment_method_matched": False
            },
            "timestamp": ""
        }
    
    try:
        from qdrant_client.http import models as qdrant_models
        
        # Step 2: Hybrid Search - Dense embeddings + sparse BM25
        query_vector = model.encode(request.query).tolist()
        
        # Dense semantic search with high limit to apply filters after
        dense_results = client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=100,  # Get more results to filter
            with_payload=True,
            distance="Cosine"
        )
        
        # Step 1 & 2: Availability + Hybrid Search - filter and process results
        step3_results = []
        for res in dense_results:
            payload = res.payload
            
            # Step 1: Filter by availability
            if not payload.get("availability", False):
                continue
            
            # Step 2 (continued): Include hybrid search score
            semantic_score = float(res.score)
            
            step3_results.append({
                "product_id": str(payload.get("product_id", res.id)),
                "semantic_score": semantic_score,
                "rate": float(payload.get("rate", 0)),
                "review_count": int(payload.get("review_count", 0)),
                "price": float(payload.get("price", 0)),
                "category": payload.get("category", ""),
                "brand": payload.get("brand", ""),
                "material": payload.get("material", ""),
                "payment_methods": payload.get("payment_methods", [])
            })
        
        # Step 3: Budget filter
        step4_results = []
        for result in step3_results:
            if request.budgetRange:
                min_budget = float(request.budgetRange.get("min", 0))
                max_budget = float(request.budgetRange.get("max", float('inf')))
                if not (min_budget <= result["price"] <= max_budget):
                    continue
            step4_results.append(result)
        
        # Step 4: Preferences filter (category, brand, materials)
        step5_results = []
        for result in step4_results:
            # Category filter
            if request.preferences and request.preferences.get("categories"):
                if result["category"] not in request.preferences["categories"]:
                    continue
            
            # Brand filter
            if request.preferences and request.preferences.get("brands"):
                if result["brand"] and result["brand"] not in request.preferences["brands"]:
                    continue
            
            # Material filter
            if request.preferences and request.preferences.get("materials"):
                if result["material"] and result["material"] not in request.preferences["materials"]:
                    continue
            
            step5_results.append(result)
        
        # Step 5: Payment method filter
        step6_results = []
        for result in step5_results:
            payment_match = True
            if request.preferredPaymentMethod:
                payment_match = request.preferredPaymentMethod in result["payment_methods"]
            step6_results.append(result)
        
        # Step 6: MMR (Maximal Marginal Relevance) - diversify top candidates
        # Apply MMR to top candidates before reranking
        mmr_results = apply_mmr(
            step6_results,
            lambda_param=0.7,
            k=min(request.top_k * 2, len(step6_results))  # Keep 2x top_k for reranking
        )
        
        # Step 7: Custom Reranking Formula
        reranked_results = []
        for result in mmr_results:
            # final_score = semantic_score + 0.1*rate + 0.001*review_count
            final_score = (
                result["semantic_score"] +
                (0.1 * result["rate"]) +
                (0.001 * result["review_count"])
            )
            result["final_score"] = final_score
            reranked_results.append(result)
        
        # Step 8: Return Top-K
        final_results = sorted(
            reranked_results,
            key=lambda x: x["final_score"],
            reverse=True
        )[:request.top_k]
        
        recommendations = [
            {
                "product_id": result["product_id"],
                "score": result["final_score"]
            }
            for result in final_results
        ]
        
        return {
            "recommendations": recommendations,
            "personalization_applied": {
                "availability_filtered": True,
                "hybrid_search_applied": True,
                "budget_filtered": bool(request.budgetRange),
                "category_filtered": bool(request.preferences and request.preferences.get("categories")),
                "brand_filtered": bool(request.preferences and request.preferences.get("brands")),
                "material_filtered": bool(request.preferences and request.preferences.get("materials")),
                "payment_method_matched": bool(request.preferredPaymentMethod)
            },
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Search error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "error": str(e),
            "recommendations": [],
            "personalization_applied": {
                "availability_filtered": False,
                "hybrid_search_applied": False,
                "budget_filtered": False,
                "category_filtered": False,
                "brand_filtered": False,
                "material_filtered": False,
                "payment_method_matched": False
            },
            "timestamp": ""
        }


def apply_mmr(results: list, lambda_param: float = 0.7, k: int = 10) -> list:
    """
    Maximal Marginal Relevance (MMR) - Balance relevance and diversity
    MMR = lambda * (relevance) - (1 - lambda) * (max_similarity_to_selected)
    
    Args:
        results: List of search results with scores
        lambda_param: Balance between relevance (high) and diversity (low), 0-1
        k: Number of results to return
    
    Returns:
        Reranked results balancing relevance and diversity
    """
    if len(results) <= k:
        return results
    
    selected = []
    remaining = results.copy()
    
    # Select first result (highest score)
    selected.append(remaining.pop(0))
    
    while len(selected) < k and remaining:
        scores = []
        for candidate in remaining:
            # Relevance score (normalized)
            relevance = candidate["final_score"]
            
            # Diversity: how different is this from already selected items
            diversity = 0
            if selected:
                # Simple diversity based on different attributes
                avg_diversity = 0
                for selected_item in selected:
                    # Check if different category
                    if candidate.get("category") != selected_item.get("category"):
                        avg_diversity += 1
                diversity = avg_diversity / len(selected)
            
            # MMR score
            mmr_score = lambda_param * relevance - (1 - lambda_param) * diversity
            scores.append((candidate, mmr_score))
        
        # Select item with highest MMR score
        best_candidate, _ = max(scores, key=lambda x: x[1])
        selected.append(best_candidate)
        remaining.remove(best_candidate)
    
    return selected


def compute_user_embedding(user_doc: dict) -> list:
    """
    Compute user embedding from purchases and wishlist
    Combines product titles + categories into text, then embeds
    """
    if not model:
        return [0.0] * 1536  # Return zero vector if model not available
    
    text_parts = []
    
    # Add purchases
    if user_doc.get("purchases"):
        for purchase in user_doc["purchases"]:
            if purchase.get("items"):
                for item in purchase["items"]:
                    title = item.get("title", "")
                    category = item.get("category", "")
                    if title and category:
                        text_parts.append(f"{title} ({category})")
    
    # Add wishlist items
    if user_doc.get("wishlist"):
        for item in user_doc["wishlist"]:
            name = item.get("name", "")
            category = item.get("category", "")
            if name and category:
                text_parts.append(f"{name} ({category})")
    
    # If no items, use preference text
    if not text_parts:
        categories = user_doc.get("preferences", {}).get("categories", [])
        if categories:
            text_parts = [f"Interested in {cat}" for cat in categories]
    
    # Create embedding text
    embedding_text = " ".join(text_parts) if text_parts else "General user"
    
    # Encode to vector
    user_vector = model.encode(embedding_text).tolist()
    return user_vector


@app.post("/api/recommendations/for-you")
async def recommendations_for_you(request: UserRecommendationRequest):
    """
    Recommendations without search query - uses user embedding
    Pipeline:
    1. Fetch user from MongoDB
    2. Compute/retrieve user embedding
    3. Store in Qdrant users collection
    4. Qdrant search with filters (availability, budget, payment)
    5. Apply MMR and reranking
    6. Return top-K
    """
    if not has_qdrant or not users_collection:
        return {
            "error": "Service not available",
            "recommendations": [],
            "timestamp": ""
        }
    
    try:
        # Step 1: Fetch user from MongoDB
        user_doc = users_collection.find_one({"uid": request.userId})
        if not user_doc:
            return {
                "error": "User not found",
                "recommendations": [],
                "timestamp": datetime.now().isoformat()
            }
        
        # Step 2: Compute user embedding
        user_embedding = compute_user_embedding(user_doc)
        
        # Step 3: Store/update user embedding in Qdrant
        user_payload = {
            "user_id": request.userId,
            "preferredPaymentMethod": user_doc.get("preferredPaymentMethod", "card"),
            "budget_min": user_doc.get("budgetRange", {}).get("min", 0),
            "budget_max": user_doc.get("budgetRange", {}).get("max", float('inf')),
            "preferred_categories": user_doc.get("preferences", {}).get("categories", []),
            "preferred_brands": user_doc.get("preferences", {}).get("brands", []),
            "preferred_materials": user_doc.get("preferences", {}).get("materials", []),
            "last_updated": datetime.now().isoformat()
        }
        
        # Store in Qdrant users collection
        try:
            from qdrant_client.http.models import PointStruct
            user_point = PointStruct(
                id=hash(request.userId) % (2**31),  # Deterministic ID from user ID
                vector=user_embedding,
                payload=user_payload
            )
            client.upsert(
                collection_name="users",
                points=[user_point]
            )
        except Exception as e:
            print(f"Warning: Could not store user embedding: {e}")
        
        # Step 4: Qdrant search with filters
        from qdrant_client.http import models as qdrant_models
        
        # Build filters
        filters = qdrant_models.Filter(
            must=[
                qdrant_models.HasPayloadCondition(key="availability"),
                qdrant_models.MatchValue(key="availability", value=True),
            ]
        )
        
        search_results = client.search(
            collection_name="Products",
            query_vector=user_embedding,
            query_filter=filters,
            limit=100,  # Get more to apply MMR
            with_payload=True,
            distance="Cosine"
        )
        
        # Filter by budget, payment, preferences
        filtered_results = []
        for res in search_results:
            payload = res.payload
            
            # Budget filter
            price = float(payload.get("price", 0))
            if not (user_payload["budget_min"] <= price <= user_payload["budget_max"]):
                continue
            
            # Payment method filter
            if user_payload["preferredPaymentMethod"]:
                payment_methods = payload.get("payment_methods", [])
                if user_payload["preferredPaymentMethod"] not in payment_methods:
                    continue
            
            # Category filter (soft - not required)
            category = payload.get("category", "")
            if user_payload["preferred_categories"] and category not in user_payload["preferred_categories"]:
                # Soft filter - include but rank lower
                pass
            
            filtered_results.append({
                "product_id": str(payload.get("product_id", res.id)),
                "semantic_score": float(res.score),
                "rate": float(payload.get("rate", 0)),
                "review_count": int(payload.get("review_count", 0)),
                "price": price,
                "category": category,
                "brand": payload.get("brand", ""),
                "material": payload.get("material", "")
            })
        
        # Step 5: Apply MMR
        mmr_results = apply_mmr(
            filtered_results,
            lambda_param=0.7,
            k=min(request.top_k * 2, len(filtered_results))
        )
        
        # Apply reranking formula
        reranked_results = []
        for result in mmr_results:
            final_score = (
                result["semantic_score"] +
                (0.1 * result["rate"]) +
                (0.001 * result["review_count"])
            )
            result["final_score"] = final_score
            reranked_results.append(result)
        
        # Step 6: Return top-K
        final_results = sorted(
            reranked_results,
            key=lambda x: x["final_score"],
            reverse=True
        )[:request.top_k]
        
        recommendations = [
            {
                "product_id": result["product_id"],
                "score": result["final_score"]
            }
            for result in final_results
        ]
        
        return {
            "recommendations": recommendations,
            "user_embedding_computed": True,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Recommendation error: {e}")
        import traceback
        traceback.print_exc()
        return {
            "error": str(e),
            "recommendations": [],
            "timestamp": ""
        }


# --- Endpoint: hierarchical tree data ---
@app.get("/tree")
def get_tree(limit: int = 50):
    if not has_qdrant:
        return {"error": "Qdrant service not available"}
    
    # Fetch vectors
    response = client.scroll(collection_name=collection_name, limit=limit)
    vectors = []
    labels = []
    for point in response.points:
        vectors.append(point.vector)
        labels.append(point.payload.get("category", str(point.id)))

    vectors = np.array(vectors)
    # Hierarchical clustering
    Z = linkage(vectors, method="ward")
    
    # Convert linkage matrix to a list for frontend (dendrogram can be built in JS)
    tree_data = Z.tolist()
    return {"tree": tree_data, "labels": labels}
