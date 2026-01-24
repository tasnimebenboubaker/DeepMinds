from fastapi import APIRouter
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
