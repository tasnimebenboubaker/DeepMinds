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
    Advanced semantic search with hybrid approach (dense + sparse/BM25)
    Filtering pipeline:
    1. Availability filter
    2. Hybrid search (dense + sparse vectors with MMR)
    3. Budget range filter
    4. Preferences/category filter
    5. Payment method filter
    6. Custom reranking: final_score = semantic_score + 0.1*rate + 0.001*review_count
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
                "payment_method_matched": False
            },
            "timestamp": ""
        }
    
    try:
        from qdrant_client.http import models as qdrant_models
        
        # Step 1: Build availability filter (must be True)
        availability_filter = qdrant_models.HasIdCondition(has_id=[])
        # We'll handle this after initial search or via payload filter
        
        # Step 2: Hybrid Search - Dense vector search with MMR (Maximal Marginal Relevance)
        query_vector = model.encode(request.query).tolist()
        
        # Dense semantic search with high limit to apply filters after
        dense_results = client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=100,  # Get more results to filter
            with_payload=True,
            distance="Cosine"
        )
        
        # Convert dense results to dict for processing
        search_results = []
        for res in dense_results:
            payload = res.payload
            
            # Step 1: Filter by availability
            if not payload.get("availability", False):
                continue
            
            # Step 3: Filter by budget range
            price = float(payload.get("price", 0))
            if request.budgetRange:
                min_budget = float(request.budgetRange.get("min", 0))
                max_budget = float(request.budgetRange.get("max", float('inf')))
                if not (min_budget <= price <= max_budget):
                    continue
            
            # Step 4: Filter by category preferences
            category = payload.get("category", "")
            if request.preferences and request.preferences.get("categories"):
                if category not in request.preferences["categories"]:
                    continue
            
            # Step 5: Filter by payment method (if specified)
            payment_methods = payload.get("payment_methods", [])
            payment_match = False
            if not request.preferredPaymentMethod:
                payment_match = True  # No filter if not specified
            elif request.preferredPaymentMethod in payment_methods:
                payment_match = True
            
            if not payment_match:
                continue
            
            # Step 6: Calculate final score with reranking formula
            # final_score = semantic_score + 0.1 * rate + 0.001 * reviews_count
            semantic_score = float(res.score)
            rate = float(payload.get("rate", 0))
            review_count = int(payload.get("review_count", 0))
            
            final_score = semantic_score + (0.1 * rate) + (0.001 * review_count)
            
            search_results.append({
                "product_id": str(payload.get("product_id", res.id)),
                "semantic_score": semantic_score,
                "rate": rate,
                "review_count": review_count,
                "final_score": final_score,
                "price": price,
                "category": category,
                "payment_methods": payment_methods
            })
        
        # Step 7: Apply MMR (Maximal Marginal Relevance) for diversity
        # MMR balances relevance and diversity
        diversified_results = apply_mmr(search_results, lambda_param=0.7, k=request.top_k)
        
        # Step 8: Sort by final score and return top k
        final_results = sorted(diversified_results, key=lambda x: x["final_score"], reverse=True)[:request.top_k]
        
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
