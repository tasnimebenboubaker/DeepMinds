from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance
from config import QDRANT_URL, QDRANT_API_KEY

# connexion à Qdrant Cloud
client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY
)

COLLECTION_NAME = "Products"

# Crée ou recrée la collection (supprime si existante)
client.recreate_collection(
    collection_name=COLLECTION_NAME,
    vectors_config=VectorParams(
        size=384,       # taille de l'embedding MiniLM
        distance=Distance.COSINE
    )
)

print("✅ Collection créée")
