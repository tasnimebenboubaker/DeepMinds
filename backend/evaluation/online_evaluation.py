from typing import List, Dict, Set, Optional
from datetime import datetime, timezone
from pymongo import MongoClient
from qdrant_client import QdrantClient
from dotenv import load_dotenv
import os
import uuid

# =========================
# CONFIG
# =========================

load_dotenv()

def require_env(k: str) -> str:
    v = os.getenv(k)
    if not v:
        raise RuntimeError(f"Missing env var: {k}")
    return v

MONGO_URI = require_env("MONGODB_URI")
DB_NAME = require_env("DB_NAME")
QDRANT_URL = require_env("QDRANT_URL")
QDRANT_API_KEY = require_env("QDRANT_API_KEY")

USERS_COLLECTION = "users"
QDRANT_COLLECTION = "Products"
TOP_K = 10
MAX_PRICE = 2000

mongo = MongoClient(MONGO_URI)[DB_NAME][USERS_COLLECTION]
qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

# =========================
# HELPERS
# =========================

def parse_date(v) -> Optional[datetime]:
    if isinstance(v, datetime):
        return v
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None

def is_uuid(v) -> bool:
    try:
        uuid.UUID(str(v))
        return True
    except Exception:
        return False

# =========================
# GROUND TRUTH
# =========================

def get_wishlist(user: Dict) -> Set[str]:
    """
    Retourne un set de UUID valides depuis la wishlist de l'utilisateur.
    Accepte les champs "productId" ou "id".
    """
    wishlist_ids = set()
    for w in user.get("wishlist", []):
        pid = w.get("productId") or w.get("id")
        if pid and is_uuid(pid):
            wishlist_ids.add(str(pid))
    return wishlist_ids


def get_purchased(user: Dict, cutoff: datetime) -> Set[str]:
    out = set()
    for p in user.get("purchases", []):
        d = parse_date(p.get("purchasedAt"))
        if not d or d > cutoff:
            continue
        for it in p.get("items", []):
            pid = it.get("productId")
            if is_uuid(pid):
                out.add(str(pid))
    return out

# =========================
# RECOMMENDER
# =========================
def recommend_similar_products(user: Dict, purchased: Set[str], top_k=10) -> List[str]:
    recs = set()
    offset = None

    # Références depuis wishlist et achats : on conserve seulement les catégories
    reference_categories = set()
    for w in user.get("wishlist", []):
        category = w.get("category")
        if category:
            reference_categories.add(category.lower())
    for p in user.get("purchases", []):
        d = parse_date(p.get("purchasedAt"))
        if not d or d > datetime.now(timezone.utc):
            continue
        for it in p.get("items", []):
            category = it.get("category")
            if category:
                reference_categories.add(category.lower())

    print("Reference categories:", reference_categories)

    # Parcourir Qdrant
    while len(recs) < top_k:
        points, offset = qdrant.scroll(
            collection_name=QDRANT_COLLECTION,
            limit=50,
            offset=offset,
            with_payload=True
        )
        if not points:
            break

        for p in points:
            payload = p.payload or {}
            category = (payload.get("category") or "").lower()
            availability = payload.get("availability", False)
            pid = payload.get("product_id") or str(uuid.uuid4())  # Génère un ID fictif si absent

            if not category or not availability:
                continue
            if category not in reference_categories:
                continue

            recs.add(pid)
            if len(recs) >= top_k:
                break

        if offset is None:
            break

    return list(recs)


def generate_logs(cutoff: datetime) -> List[Dict]:
    logs = []

    for user in mongo.find({}):
        uid = user.get("uid")
        if not uid:
            continue

        wishlist = set(w.get("id") or w.get("productId") for w in user.get("wishlist", []))
        purchased = set()
        for p in user.get("purchases", []):
            d = parse_date(p.get("purchasedAt"))
            if not d or d > cutoff:
                continue
            for it in p.get("items", []):
                pid = it.get("productId")
                if pid:
                    purchased.add(pid)

        displayed = recommend_similar_products(user, purchased, top_k=TOP_K)
        if not displayed:
            continue

        clicked = [pid for pid in displayed if pid in wishlist][:1]
        added_to_cart = [pid for pid in displayed if pid in wishlist | purchased][:1]

        logs.append({
            "user_id": uid,
            "timestamp": cutoff,
            "displayed_ids": displayed,
            "clicked_ids": clicked,
            "added_to_cart": added_to_cart,
            "max_price": MAX_PRICE
        })

        print("Wishlist IDs:", wishlist)
        print("Purchased IDs:", purchased)
        print("Displayed IDs:", displayed)

    return logs

# =========================
# EVALUATION
# =========================

def run_evaluation(logs: List[Dict]) -> None:
    total_displays = 0
    total_clicks = 0
    total_cart = 0
    constraint_violations = 0

    for log in logs:
        total_displays += len(log["displayed_ids"])
        total_clicks += len(log["clicked_ids"])
        total_cart += len(log["added_to_cart"])

        for pid in log["displayed_ids"]:
            try:
                point = qdrant.retrieve(
                    collection_name=QDRANT_COLLECTION,
                    ids=[uuid.UUID(pid)]
                )
                if not point:
                    continue
                payload = point[0].payload or {}
                if payload.get("price", 0) > log["max_price"]:
                    constraint_violations += 1
                if payload.get("availability") is False:
                    constraint_violations += 1
            except Exception:
                continue

    print("=" * 60)
    print("ONLINE BUSINESS METRICS")
    print("=" * 60)

    if total_displays == 0:
        print("No displays")
        return

    print(f"CTR: {total_clicks / total_displays:.4f}")
    print(f"Add-to-Cart Rate: {total_cart / total_displays:.4f}")
    print(f"Constraint Violation Rate: {constraint_violations / total_displays:.4f}")
    print("=" * 60)

# =========================
# MAIN
# =========================

if __name__ == "__main__":
    cutoff = datetime.now(timezone.utc)
    logs = generate_logs(cutoff)

    print(f"Generated {len(logs)} logs")
    run_evaluation(logs)
    