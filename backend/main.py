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
    top_k: int = 5

# --- Request model for user search with preferences ---
class UserSearchRequest(BaseModel):
    query: str
    userId: str
    budgetRange: dict
    preferences: dict
    preferredPaymentMethod: str
    top_k: int = 5

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

# --- Endpoint: user search with preferences ---
@app.post("/api/search/user-search")
async def user_search(request: UserSearchRequest):
    """
    Semantic search with user preference filters
    Returns product recommendations based on query + user preferences
    """
    if not has_qdrant:
        return {
            "error": "Search service not available",
            "recommendations": [],
            "personalization_applied": False,
            "timestamp": ""
        }
    
    try:
        # Encode the query
        query_vector = model.encode(request.query).tolist()
        
        # Search Qdrant with filters based on preferences
        results = client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=request.top_k,
            with_payload=True,
            distance="Cosine"
        )
        
        # Filter by budget range if provided
        filtered_results = []
        for res in results:
            price = res.payload.get("price", 0)
            
            # Check budget range
            if request.budgetRange:
                min_budget = request.budgetRange.get("min", 0)
                max_budget = request.budgetRange.get("max", float('inf'))
                if not (min_budget <= price <= max_budget):
                    continue
            
            # Check category preferences if provided
            category = res.payload.get("category", "")
            if request.preferences and request.preferences.get("categories"):
                if category not in request.preferences["categories"]:
                    continue
            
            filtered_results.append({
                "product_id": str(res.id),
                "score": float(res.score)
            })
        
        return {
            "recommendations": filtered_results,
            "personalization_applied": True,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Search error: {e}")
        return {
            "error": str(e),
            "recommendations": [],
            "personalization_applied": False,
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
