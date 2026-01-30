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

def get_wishlist(user: Dict) -> Set[str]:
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

def recommend_similar_products_with_score(user: Dict, purchased: Set[str], top_k=10) -> List[Dict]:
    """
    Recommandations depuis Qdrant en conservant le score.
    Filtre sur :
        - disponibilité
        - catégories présentes dans wishlist / achats
    """
    recs = []
    offset = None

    # Références : categories de wishlist + achats
    reference_categories = set()
    for w in user.get("wishlist", []):
        category = w.get("category")
        if category:
            reference_categories.add(category.lower())
    for p in user.get("purchases", []):
        for it in p.get("items", []):
            category = it.get("category")
            if category:
                reference_categories.add(category.lower())

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
            pid = payload.get("product_id") or str(uuid.uuid4())
            score = getattr(p, "score", 1.0)  # Scroll n'a pas toujours score

            if not category or not availability:
                continue
            if category not in reference_categories:
                continue
            if payload.get("price", 0) > MAX_PRICE:
                continue

            recs.append({"product_id": pid, "score": score})
            if len(recs) >= top_k:
                break

        if offset is None:
            break

    return recs[:top_k]

def generate_logs(cutoff: datetime) -> List[Dict]:
    logs = []

    for user in mongo.find({}):
        uid = user.get("uid")
        if not uid:
            continue

        wishlist = get_wishlist(user)
        purchased = get_purchased(user, cutoff)

        displayed = recommend_similar_products_with_score(user, purchased, top_k=TOP_K)
        if not displayed:
            continue

        clicked = [d for d in displayed if d["product_id"] in wishlist][:1]
        added_to_cart = [d for d in displayed if d["product_id"] in wishlist | purchased][:1]

        logs.append({
            "user_id": uid,
            "timestamp": cutoff,
            "displayed": displayed,       # contient maintenant product_id + score
            "clicked": clicked,
            "added_to_cart": added_to_cart,
            "max_price": MAX_PRICE
        })

        print(f"User: {uid}")
        print(f"Wishlist IDs: {wishlist}")
        print(f"Purchased IDs: {purchased}")
        print(f"Displayed: {displayed}")

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
        total_displays += len(log["displayed"])
        total_clicks += len(log["clicked"])
        total_cart += len(log["added_to_cart"])

        for rec in log["displayed"]:
            pid = rec["product_id"]
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
