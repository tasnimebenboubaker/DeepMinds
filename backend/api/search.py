from fastapi import APIRouter
from pydantic import BaseModel
from services.integration_service import search_products, add_product_with_embedding, delete_product_from_both

router = APIRouter()

class ProductInput(BaseModel):
    name: str
    description: str
    price: float
    payment_methods: list

@router.post("/search")
def search_by_query(query: str, limit: int = 10):
    """Chercher des produits par texte"""
    results = search_products(query, limit)
    return {
        "query": query,
        "results": results,
        "total": len(results)
    }

@router.post("/products")
def create_product(product: ProductInput):
    """Créer un nouveau produit"""
    product_id = add_product_with_embedding(product.dict())
    return {
        "status": "created",
        "product_id": product_id
    }

@router.delete("/products/{product_id}")
def remove_product(product_id: str):
    """Supprimer un produit"""
    delete_product_from_both(product_id)
    return {
        "status": "deleted",
        "product_id": product_id
    }

from services.embedding_service import embed_text
from services.qdrant_service import client, COLLECTION_NAME
from qdrant_client.models import Filter, FieldCondition, Range

router = APIRouter()

@router.post("/search")
def search_products(
    query: str,
    budget: float,
    payment: str
):
    query_vector = embed_text(query)

    filter_condition = Filter(
        must=[
            FieldCondition(
                key="price",
                range=Range(lte=budget)
            ),
            FieldCondition(
                key="payment_methods",
                match={"value": payment}
            )
        ]
    )

    results = client.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=5,
        filter=filter_condition
    )

    response = []
    for r in results:
        response.append({
            "product_id": r.id,
            "score": r.score,
            "why": [
                "Correspond à votre recherche",
                "Dans votre budget",
                "Paiement compatible"
            ]
        })

    return response
