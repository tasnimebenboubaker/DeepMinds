from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from config import QDRANT_URL, QDRANT_API_KEY
from services.embedding_service import embed_text
from services.mongodb_service import mongo_service
from typing import List, Dict, Any

client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY
)

COLLECTION_NAME = "DeepMinds"

def add_product_with_embedding(product_data: Dict[str, Any]) -> str:
    """
    Ajouter un produit : 
    1. Enregistrer dans MongoDB
    2. Créer un embedding et l'ajouter à Qdrant
    """
    # Insérer dans MongoDB
    mongodb_id = mongo_service.insert_product(product_data)
    
    # Créer l'embedding à partir du nom et description
    text_to_embed = f"{product_data.get('name', '')} {product_data.get('description', '')}"
    embedding = embed_text(text_to_embed)
    
    # Ajouter à Qdrant
    point = PointStruct(
        id=int(mongodb_id[:8], 16) if len(mongodb_id) >= 8 else hash(mongodb_id) & 0x7fffffff,
        vector=embedding,
        payload={
            "mongodb_id": mongodb_id,
            "name": product_data.get("name"),
            "description": product_data.get("description"),
        }
    )
    
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=[point]
    )
    
    return mongodb_id

def search_products(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Rechercher des produits :
    1. Créer un embedding pour la requête
    2. Chercher dans Qdrant
    3. Récupérer les détails complets depuis MongoDB
    """
    # Créer l'embedding pour la requête
    query_embedding = embed_text(query)
    
    # Chercher dans Qdrant
    search_results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_embedding,
        limit=limit
    )
    
    # Récupérer les produits complets depuis MongoDB
    products = []
    for result in search_results:
        mongodb_id = result.payload.get("mongodb_id")
        product = mongo_service.get_product(mongodb_id)
        if product:
            product["score"] = result.score
            products.append(product)
    
    return products

def delete_product_from_both(product_id: str) -> bool:
    """Supprimer un produit de MongoDB et Qdrant"""
    # Supprimer de MongoDB
    mongo_service.delete_product(product_id)
    
    # Supprimer de Qdrant
    qdrant_id = int(product_id[:8], 16) if len(product_id) >= 8 else hash(product_id) & 0x7fffffff
    client.delete(
        collection_name=COLLECTION_NAME,
        points_selector=[qdrant_id]
    )
    
    return True
