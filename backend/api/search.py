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

