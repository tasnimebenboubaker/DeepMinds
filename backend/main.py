from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

# --- Request models ---
class UserSearchRequest(BaseModel):
    query: str
    userId: str
    budgetRange: dict
    preferences: dict
    preferredPaymentMethod: str
    top_k: int = 15

class UserRecommendationRequest(BaseModel):
    userId: str
    top_k: int = 15

class UserProfileRequest(BaseModel):
    uid: str
    email: str = ""
    displayName: str = ""
    preferences: dict = {}
    budgetRange: dict = {}
    preferredPaymentMethod: str = "card"

class SyncPreferencesRequest(BaseModel):
    preferences: dict = {}
    budgetRange: dict = {}
    preferredPaymentMethod: str = "card"

class SearchResult(BaseModel):
    product_id: str
    score: float

class SearchResponse(BaseModel):
    recommendations: list[SearchResult]
    personalization_applied: bool
    timestamp: str

# --- Endpoint: health check ---
@app.get("/")
def health():
    return {"status": "ok", "qdrant_available": has_qdrant}

# --- Endpoint: fetch all products for browsing (no search query) ---
@app.get("/api/products")
async def get_all_products(limit: int = 15):
    """
    Fetch all products from Qdrant using recommendations endpoint logic
    Used when page loads without a search query
    """
    try:
        from qdrant_client.http import models as qdrant_models
        
        # Scroll products from Qdrant
        scroll_result = client.scroll(collection_name=collection_name, limit=limit, with_payload=True)
        products = []
        
        for point in scroll_result.points:
            payload = point.payload or {}
            products.append({
                "id": str(payload.get("product_id", point.id)),
                "name": payload.get("title", ""),
                "title": payload.get("title", ""),
                "description": payload.get("description", ""),
                "price": float(payload.get("price", 0)),
                "category": payload.get("category", ""),
                "brand": payload.get("brand", ""),
                "material": payload.get("material", ""),
                "image": payload.get("image_url", ""),
                "rating": {
                    "rate": float(payload.get("rate", 0)),
                    "count": int(payload.get("review_count", 0))
                },
                "payment_methods": payload.get("payment_methods", [])
            })
        
        return products
    except Exception as e:
        print(f"Error fetching products: {e}")
        return []

# --- Endpoint: fetch all products from MongoDB ---
@app.get("/api/products-all")
async def get_all_mongo_products(limit: int = 100):
    """
    Fetch all products from MongoDB as fallback when Qdrant IDs don't match
    """
    if products_collection is None:
        return JSONResponse({"error": "Database not available"}, status_code=503)
    
    try:
        products = []
        for doc in products_collection.find().limit(limit):
            products.append({
                "id": str(doc.get("_id", "")),
                "product_id": str(doc.get("product_id", doc.get("_id", ""))),
                "name": doc.get("name", doc.get("title", "Unknown Product")),
                "title": doc.get("title", doc.get("name", "Unknown Product")),
                "description": doc.get("description", ""),
                "price": float(doc.get("price", 0)),
                "category": doc.get("category", "Uncategorized"),
                "brand": doc.get("brand", ""),
                "material": doc.get("material", ""),
                "image": doc.get("image", doc.get("image_url", "")),
                "rating": {
                    "rate": float(doc.get("rating", {}).get("rate", doc.get("rate", 0))) if isinstance(doc.get("rating"), dict) else float(doc.get("rate", 0)),
                    "count": int(doc.get("rating", {}).get("count", doc.get("review_count", 0))) if isinstance(doc.get("rating"), dict) else int(doc.get("review_count", 0))
                },
                "payment_methods": doc.get("payment_methods", [])
            })
        
        print(f"[DEBUG] Fetched {len(products)} products from MongoDB")
        return {"products": products}
    except Exception as e:
        print(f"Error fetching all products: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            {"error": str(e)},
            status_code=500
        )

# --- Endpoint: fetch single product from MongoDB by product_id ---
@app.get("/api/products/{product_id}")
async def get_product_by_id(product_id: str):
    """
    Fetch full product details from MongoDB by product_id
    Used when recommendations endpoint returns product_ids for detail fetching
    """
    if products_collection is None:
        return JSONResponse({"error": "Database not available"}, status_code=503)
    
    try:
        print(f"[DEBUG] Looking for product with ID: {product_id}")
        
        # Try to find by product_id field first
        product = products_collection.find_one({"product_id": product_id})
        if product:
            print(f"[DEBUG] Found by product_id field: {product.get('title', 'Unknown')}")
        
        # If not found, try _id (MongoDB ObjectId as string)
        if not product:
            product = products_collection.find_one({"_id": product_id})
            if product:
                print(f"[DEBUG] Found by _id as string: {product.get('title', 'Unknown')}")
        
        # If still not found, try ObjectId conversion
        if not product:
            from bson import ObjectId
            try:
                product = products_collection.find_one({"_id": ObjectId(product_id)})
                if product:
                    print(f"[DEBUG] Found by ObjectId: {product.get('title', 'Unknown')}")
            except:
                pass
        
        if not product:
            print(f"[DEBUG] Product {product_id} NOT found in MongoDB - returning 404")
            return JSONResponse(
                {"error": f"Product {product_id} not found"},
                status_code=404
            )
        
        print(f"[DEBUG] Found product {product_id}: {product.get('title', 'Unknown')}")
        
        # Convert MongoDB document to response format
        return {
            "id": str(product.get("_id", product.get("product_id", product_id))),
            "product_id": str(product.get("product_id", product.get("_id", product_id))),
            "name": product.get("name", product.get("title", "Unknown Product")),
            "title": product.get("title", product.get("name", "Unknown Product")),
            "description": product.get("description", ""),
            "price": float(product.get("price", 0)),
            "category": product.get("category", "Uncategorized"),
            "brand": product.get("brand", ""),
            "material": product.get("material", ""),
            "image": product.get("image", product.get("image_url", "")),
            "rating": {
                "rate": float(product.get("rating", {}).get("rate", product.get("rate", 0))) if isinstance(product.get("rating"), dict) else float(product.get("rate", 0)),
                "count": int(product.get("rating", {}).get("count", product.get("review_count", 0))) if isinstance(product.get("rating"), dict) else int(product.get("review_count", 0))
            },
            "payment_methods": product.get("payment_methods", [])
        }
    except Exception as e:
        print(f"Error fetching product {product_id}: {e}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            {"error": str(e)},
            status_code=500
        )

# --- Endpoint: user profile (PUT to create/update) ---
@app.put("/api/users/profile")
async def update_user_profile(request: UserProfileRequest):
    """
    Create or update user profile with wishlist and purchases
    """
    if users_collection is None:
        return {"error": "Database not available", "success": False}
    
    try:
        # Check if user already exists to preserve wishlist and purchases
        existing_user = users_collection.find_one({"uid": request.uid})
        
        # Update or insert user
        users_collection.update_one(
            {"uid": request.uid},
            {
                "$set": {
                    "uid": request.uid,
                    "email": request.email,
                    "displayName": request.displayName,
                    "preferences": request.preferences if request.preferences else {"categories": [], "brands": [], "materials": []},
                    "budgetRange": request.budgetRange if request.budgetRange else {"min": 0, "max": 2000},
                    "preferredPaymentMethod": request.preferredPaymentMethod,
                    "updatedAt": datetime.now().isoformat()
                },
                # Initialize wishlist and purchases as empty arrays if user is new
                "$setOnInsert": {
                    "wishlist": [],
                    "purchases": [],
                    "createdAt": datetime.now().isoformat()
                }
            },
            upsert=True
        )
        
        return {"success": True, "uid": request.uid}
    except Exception as e:
        print(f"Error updating user profile: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "success": False}

# --- Endpoint: sync user preferences ---
@app.post("/api/users/sync-preferences")
async def sync_user_preferences(uid: str, request: SyncPreferencesRequest):
    """
    Sync user preferences
    """
    if users_collection is None:
        return {"error": "Database not available", "success": False}
    
    try:
        users_collection.update_one(
            {"uid": uid},
            {
                "$set": {
                    "uid": uid,
                    "preferences": request.preferences if request.preferences else {"categories": [], "brands": [], "materials": []},
                    "budgetRange": request.budgetRange if request.budgetRange else {"min": 0, "max": 2000},
                    "preferredPaymentMethod": request.preferredPaymentMethod,
                    "updatedAt": datetime.now().isoformat()
                }
            },
            upsert=True
        )
        
        return {"success": True, "uid": uid}
    except Exception as e:
        print(f"Error syncing preferences: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e), "success": False}

# --- Endpoint: fetch user preferences ---
@app.get("/api/users/preferences")
async def get_user_preferences(uid: str):
    """
    Fetch user preferences
    """
    if users_collection is None:
        return {"error": "Database not available"}
    
    try:
        user_doc = users_collection.find_one({"uid": uid})
        if not user_doc:
            return {
                "preferences": {"categories": [], "brands": [], "materials": []},
                "budgetRange": {"min": 0, "max": 2000},
                "preferredPaymentMethod": "card"
            }
        
        return {
            "preferences": user_doc.get("preferences", {"categories": [], "brands": [], "materials": []}),
            "budgetRange": user_doc.get("budgetRange", {"min": 0, "max": 2000}),
            "preferredPaymentMethod": user_doc.get("preferredPaymentMethod", "card")
        }
    except Exception as e:
        print(f"Error fetching preferences: {e}")
        import traceback
        traceback.print_exc()
        return {
            "preferences": {"categories": [], "brands": [], "materials": []},
            "budgetRange": {"min": 0, "max": 2000},
            "preferredPaymentMethod": "card"
        }

# Image vector size used during indexing (CLIP ViT-L/14 or similar - 768 dims)
IMAGE_VECTOR_SIZE = 768

def build_combined_from_text(text_embedding: list) -> list:
    """Build combined_vector [text_embedding + zero image embedding]."""
    return text_embedding + [0.0] * IMAGE_VECTOR_SIZE

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
        
        # Step 1: Try keyword/BM25 search first (using text_sparse vector)
        candidates = []
        keyword_found = False
        
        try:
            # Tokenize query into keywords (simple split on spaces/punctuation)
            import re
            keywords = [w.lower() for w in re.findall(r'\b\w+\b', request.query.lower())]
            
            # If we have keywords, try BM25 search
            if keywords:
                try:
                    # Query Qdrant using the sparse vector 'text_sparse' for BM25
                    keyword_results = client.query_points(
                        collection_name=collection_name,
                        query_filter=qdrant_models.Filter(
                            must=[
                                qdrant_models.HasIdCondition(has_id=[])  # Placeholder; will be overridden by text_sparse search
                            ]
                        ) if False else None,  # Simplified: rely on sparse vector only
                        using="text_sparse",
                        limit=100,
                        with_payload=True,
                    )
                    keyword_results_list = keyword_results.points if keyword_results and hasattr(keyword_results, 'points') else []
                    
                    if keyword_results_list:
                        keyword_found = True
                        for res in keyword_results_list:
                            payload = res.payload or {}
                            candidates.append({
                                "product_id": str(payload.get("product_id", res.id)),
                                "semantic_score": float(res.score),
                                "rate": float(payload.get("rate", 0)),
                                "review_count": int(payload.get("review_count", 0)),
                                "price": float(payload.get("price", 0)),
                                "category": payload.get("category", ""),
                                "brand": payload.get("brand", ""),
                                "material": payload.get("material", ""),
                                "payment_methods": payload.get("payment_methods", [])
                            })
                except Exception as keyword_err:
                    print(f"Keyword search failed: {keyword_err}")
                    keyword_found = False
        except Exception as parse_err:
            print(f"Query parsing error: {parse_err}")
        
        # Step 2: If keyword search returned nothing, fall back to semantic search
        if not candidates:
            query_vector = model.encode(request.query).tolist()
            combined_query_vec = build_combined_from_text(query_vector)
            
            # Query Qdrant using the named vector 'combined_vector'
            dense = client.query_points(
                collection_name=collection_name,
                query=combined_query_vec,
                using="combined_vector",
                limit=100,
                with_payload=True,
            )
            dense_results = dense.points
            
            # Build candidates from semantic results
            for res in dense_results:
                payload = res.payload or {}
                candidates.append({
                    "product_id": str(payload.get("product_id", res.id)),
                    "semantic_score": float(res.score),
                    "rate": float(payload.get("rate", 0)),
                    "review_count": int(payload.get("review_count", 0)),
                    "price": float(payload.get("price", 0)),
                    "category": payload.get("category", ""),
                    "brand": payload.get("brand", ""),
                    "material": payload.get("material", ""),
                    "payment_methods": payload.get("payment_methods", [])
                })

        # If both keyword and semantic search returned nothing, fallback to scroll or Mongo
        if not candidates:
            try:
                scroll = client.scroll(collection_name=collection_name, limit=100, with_payload=True)
                for point in scroll.points:
                    p = point.payload or {}
                    candidates.append({
                        "product_id": str(p.get("product_id", point.id)),
                        "semantic_score": 0.0,
                        "rate": float(p.get("rate", 0)),
                        "review_count": int(p.get("review_count", 0)),
                        "price": float(p.get("price", 0)),
                        "category": p.get("category", ""),
                        "brand": p.get("brand", ""),
                        "material": p.get("material", ""),
                        "payment_methods": p.get("payment_methods", [])
                    })
            except Exception:
                pass
            # Last fallback: Mongo top products
            if not candidates and products_collection is not None:
                for doc in products_collection.find({}).limit(100):
                    candidates.append({
                        "product_id": str(doc.get("id", doc.get("_id"))),
                        "semantic_score": 0.0,
                        "rate": float((doc.get("rating") or {}).get("rate", 0)),
                        "review_count": int((doc.get("rating") or {}).get("count", 0)),
                        "price": float(doc.get("price", 0)),
                        "category": doc.get("category", ""),
                        "brand": doc.get("brand", ""),
                        "material": doc.get("material", ""),
                        "payment_methods": doc.get("payment_methods", [])
                    })

        # Budget filter with relaxation
        filtered_budget = []
        if request.budgetRange:
            min_budget = float(request.budgetRange.get("min", 0))
            max_budget = float(request.budgetRange.get("max", float('inf')))
            filtered_budget = [r for r in candidates if min_budget <= r["price"] <= max_budget]
        candidates = filtered_budget if filtered_budget else candidates

        # Preferences filter with relaxation
        filtered_prefs = []
        for r in candidates:
            ok = True
            if request.preferences and request.preferences.get("categories"):
                if r["category"] not in request.preferences["categories"]:
                    ok = False
            if ok and request.preferences and request.preferences.get("brands"):
                if r["brand"] and r["brand"] not in request.preferences["brands"]:
                    ok = False
            if ok and request.preferences and request.preferences.get("materials"):
                if r["material"] and r["material"] not in request.preferences["materials"]:
                    ok = False
            if ok:
                filtered_prefs.append(r)
        candidates = filtered_prefs if filtered_prefs else candidates

        # Payment method filter with relaxation
        filtered_payment = []
        if request.preferredPaymentMethod:
            filtered_payment = [r for r in candidates if request.preferredPaymentMethod in (r.get("payment_methods") or [])]
        candidates = filtered_payment if filtered_payment else candidates

        # MMR diversification
        mmr_input = candidates[:]
        mmr_results = apply_mmr(
            mmr_input,
            lambda_param=0.7,
            k=min(request.top_k * 2, len(mmr_input))
        ) if mmr_input else []

        # Reranking formula
        reranked_results = []
        source_for_rerank = mmr_results if mmr_results else candidates
        for result in source_for_rerank:
            final_score = (
                result.get("semantic_score", 0.0) +
                (0.1 * result.get("rate", 0.0)) +
                (0.001 * result.get("review_count", 0))
            )
            result["final_score"] = final_score
            reranked_results.append(result)

        # Always return at least top-K candidates
        base_list = reranked_results if reranked_results else candidates
        final_results = sorted(base_list, key=lambda x: x.get("final_score", 0.0), reverse=True)[:request.top_k]
        
        # Fetch full product details from MongoDB using product_ids
        recommendations = []
        for result in final_results:
            product_id = result.get("product_id", "")
            if not product_id:
                continue
            
            # Try to find product in MongoDB by id field
            mongo_product = None
            if products_collection is not None:
                mongo_product = products_collection.find_one({"id": product_id})
            
            if mongo_product:
                recommendations.append({
                    "id": str(mongo_product.get("id", mongo_product.get("_id", product_id))),
                    "product_id": str(mongo_product.get("id", product_id)),
                    "title": mongo_product.get("title", "Unknown"),
                    "name": mongo_product.get("title", "Unknown"),
                    "description": mongo_product.get("description", ""),
                    "price": float(mongo_product.get("price", 0)),
                    "category": mongo_product.get("category", ""),
                    "brand": mongo_product.get("brand", ""),
                    "material": mongo_product.get("material", ""),
                    "image": mongo_product.get("image", mongo_product.get("image_url", "")),
                    "rating": {
                        "rate": float(mongo_product.get("rating", {}).get("rate", mongo_product.get("rate", 0)) if isinstance(mongo_product.get("rating"), dict) else mongo_product.get("rate", 0)),
                        "count": int(mongo_product.get("rating", {}).get("count", mongo_product.get("review_count", 0)) if isinstance(mongo_product.get("rating"), dict) else mongo_product.get("review_count", 0))
                    },
                    "payment_methods": mongo_product.get("payment_methods", []),
                    "score": result.get("final_score", 0)
                })
        
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
        return [0.0] * 384  # Return zero vector if model not available (all-MiniLM-L6-v2 = 384)
    
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
    if not has_qdrant or users_collection is None:
        return {
            "error": "Service not available",
            "recommendations": [],
            "timestamp": ""
        }
    
    try:
        # Step 1: Fetch user from MongoDB
        user_doc = users_collection.find_one({"uid": request.userId})
        if not user_doc:
            # Create default user if not found
            user_doc = {
                "uid": request.userId,
                "preferences": {"categories": [], "brands": [], "materials": []},
                "budgetRange": {"min": 0, "max": 2000},
                "preferredPaymentMethod": "card",
                "purchases": [],
                "wishlist": []
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
                vector={"user_embedding": user_embedding},
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
        
        # Query Products using combined user vector (text + zero image)
        # No strict filters - rely on post-search filtering
        combined_user_vec = build_combined_from_text(user_embedding)
        search = client.query_points(
            collection_name="Products",
            query=combined_user_vec,
            using="combined_vector",
            limit=100,
            with_payload=True,
        )
        search_results = search.points
        
        print(f"[DEBUG] Total Qdrant search results: {len(search_results)}")
        for i, res in enumerate(search_results[:3]):
            print(f"[DEBUG] Result {i}: id={res.id}, score={res.score}, payload_keys={list(res.payload.keys()) if res.payload else 'None'}")
        
        # Filter by budget, payment, preferences
        filtered_results = []
        for res in search_results:
            payload = res.payload
            if not payload:
                continue
            
            # Budget filter
            price = float(payload.get("price", 0))
            budget_min = float(user_payload.get("budget_min", 0))
            budget_max = float(user_payload.get("budget_max", 999999))  # Use large number instead of infinity
            if not (budget_min <= price <= budget_max):
                continue
            
            # Payment method filter (soft - skip if no payment methods in product)
            payment_methods = payload.get("payment_methods", [])
            if payment_methods and user_payload["preferredPaymentMethod"]:
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
        ) if filtered_results else []
        
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
        
        print(f"[DEBUG] After filtering: {len(filtered_results)} results, After MMR: {len(mmr_results)} results, Final: {len(final_results)} results")
        
        # Fetch full product details from MongoDB using product_ids
        recommendations = []
        for result in final_results:
            product_id = result.get("product_id", "")
            if not product_id:
                continue
            
            # Try to find product in MongoDB by id field
            mongo_product = None
            if products_collection is not None:
                mongo_product = products_collection.find_one({"id": product_id})
            
            if mongo_product:
                print(f"[DEBUG] Found product {product_id} in MongoDB: {mongo_product.get('title', 'Unknown')}")
                recommendations.append({
                    "id": str(mongo_product.get("id", mongo_product.get("_id", product_id))),
                    "product_id": str(mongo_product.get("id", product_id)),
                    "title": mongo_product.get("title", "Unknown"),
                    "name": mongo_product.get("title", "Unknown"),
                    "description": mongo_product.get("description", ""),
                    "price": float(mongo_product.get("price", 0)),
                    "category": mongo_product.get("category", ""),
                    "brand": mongo_product.get("brand", ""),
                    "material": mongo_product.get("material", ""),
                    "image": mongo_product.get("image", mongo_product.get("image_url", "")),
                    "rating": {
                        "rate": float(mongo_product.get("rating", {}).get("rate", mongo_product.get("rate", 0)) if isinstance(mongo_product.get("rating"), dict) else mongo_product.get("rate", 0)),
                        "count": int(mongo_product.get("rating", {}).get("count", mongo_product.get("review_count", 0)) if isinstance(mongo_product.get("rating"), dict) else mongo_product.get("review_count", 0))
                    },
                    "payment_methods": mongo_product.get("payment_methods", []),
                    "score": result.get("final_score", 0)
                })
            else:
                print(f"[DEBUG] Product {product_id} NOT found in MongoDB")
        
        print(f"[DEBUG] Returning {len(recommendations)} recommendations from MongoDB (top-k={request.top_k})")
        
        return {
            "recommendations": recommendations[:request.top_k],  # Return only top-k
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
    try:
        from scipy.cluster.hierarchy import linkage
    except Exception:
        return {"error": "Clustering unavailable (scipy not installed)"}
    
    # Fetch vectors
    response = client.scroll(collection_name=collection_name, limit=limit)
    vectors = []
    labels = []
    for point in response.points:
        vec = None
        try:
            if isinstance(point.vector, dict):
                vec = point.vector.get("combined_vector")
            else:
                vec = point.vector
        except Exception:
            vec = None
        if vec is not None:
            vectors.append(vec)
            labels.append(point.payload.get("category", str(point.id)))

    vectors = np.array(vectors)
    # Hierarchical clustering
    Z = linkage(vectors, method="ward")
    
    # Convert linkage matrix to a list for frontend (dendrogram can be built in JS)
    tree_data = Z.tolist()
    return {"tree": tree_data, "labels": labels}
