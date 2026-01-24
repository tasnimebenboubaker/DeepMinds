"""from fastapi import FastAPI
from api.search import router as search_router
app = FastAPI(title="FinCommerce Engine")
app.include_router(search_router)
@app.get("/")
def health():
    return {"status": "ok"}
"""
from fastapi import FastAPI
from pydantic import BaseModel
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer
import numpy as np
from scipy.cluster.hierarchy import linkage
from scipy.spatial.distance import pdist



# --- Connect to Qdrant ---
client = QdrantClient(url="https://ddee505b-ff10-4af6-91a3-b17b4a5ea857.us-east4-0.gcp.cloud.qdrant.io", api_key="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.t2k_5z1pOV10Y9VlQkWTNI-4-nA93A7rvolr2boTXhU")
collection_name = "Products"

# --- Load embedding model ---
model = SentenceTransformer("all-MiniLM-L6-v2")

app = FastAPI()

# --- Request model for semantic search ---
class Query(BaseModel):
    text: str
    top_k: int = 5

# --- Endpoint: semantic search / recommendations ---
@app.post("/recommend")
def recommend(query: Query):
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

# --- Endpoint: hierarchical tree data ---
@app.get("/tree")
def get_tree(limit: int = 50):
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