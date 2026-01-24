from qdrant_client import QdrantClient
from config import QDRANT_URL, QDRANT_API_KEY

client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY
)

COLLECTION_NAME = "DeepMinds"
