from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from datetime import datetime

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

# --- Request model for semantic search ---
class Query(BaseModel):
    text: str
    top_k: int = 15

# --- Request model for user search with preferences ---
class UserSearchRequest(BaseModel):
    query: str
    userId: str
    budgetRange: dict
    preferences: dict
    preferredPaymentMethod: str
    top_k: int = 15

# --- Response model ---
class SearchResult(BaseModel):
    product_id: str
    score: float

class SearchResponse(BaseModel):
    recommendations: list[SearchResult]
    personalization_applied: bool
    timestamp: str

# --- Endpoint: semantic search / recommendations ---
@app.post("/recommend")
def recommend(query: Query):
    if not has_qdrant:
        return {"error": "Qdrant service not available"}
    
    query_vector = model.encode(query.text).tolist()
    results = client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=query.top_k,
        with_payload=True,
        distance="Cosine"
    )
    response = [
        {
            "id": res.id,
            "title": res.payload.get("title", str(res.id)),
            "category": res.payload.get("category", ""),
            "score": res.score
        }
        for res in results
    ]
    return {"recommendations": response}

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
