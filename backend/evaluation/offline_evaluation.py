from typing import List, Dict, Set, Optional
from datetime import datetime, timezone
from pymongo import MongoClient
from qdrant_client import QdrantClient
from dotenv import load_dotenv
import os
import uuid

# =========================
# LOAD ENV
# =========================
load_dotenv()

def require_env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Missing env var: {name}")
    return v

MONGO_URI = require_env("MONGODB_URI")
DB_NAME = require_env("DB_NAME")
QDRANT_URL = require_env("QDRANT_URL")
QDRANT_API_KEY = require_env("QDRANT_API_KEY")

USERS_COLLECTION = "users"
QDRANT_COLLECTION = "Products"
TOP_K = 10  # pour test rapide

# =========================
# CLIENTS
# =========================
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
def get_ground_truth(user: Dict, cutoff: datetime) -> Set[str]:
    relevant = set()

    for w in user.get("wishlist", []):
        pid = w.get("productId") or w.get("id")
        if pid and is_uuid(pid):
            relevant.add(str(pid))

    for p in user.get("purchases", []):
        d = parse_date(p.get("purchasedAt"))
        if not d or d > cutoff:
            continue
        for it in p.get("items", []):
            pid = it.get("productId")
            if pid and is_uuid(pid):
                relevant.add(str(pid))

    return relevant

# =========================
# RECOMMENDATION ENGINE
# =========================
def recommend_products(user: Dict, top_k=TOP_K) -> List[str]:
    """
    Reco naïve mais fiable avec correspondance UUID
    """
    relevant_ids = get_ground_truth(user, datetime.now(timezone.utc))
    recs = []

    offset = None
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
            # ⚠️ prendre product_id du payload si point.id n'est pas UUID
            pid = p.payload.get("product_id") or str(p.id)
            if not is_uuid(pid):
                continue
            
            if p.payload.get("availability") is False:
                continue
            recs.append(pid)
            if len(recs) == top_k:
                break

        if offset is None:
            break

    return recs

# =========================
# LOG GENERATION
# =========================
def generate_logs(cutoff: datetime) -> List[Dict]:
    logs = []

    for user in mongo.find({}):
        uid = user.get("uid")
        if not uid:
            continue

        displayed = recommend_products(user, top_k=TOP_K)
        if not displayed:
            continue

        logs.append({
            "user_id": uid,
            "timestamp": cutoff,
            "displayed_ids": displayed
        })
        print("Wishlist IDs:", get_ground_truth(user, cutoff))
        print("Displayed IDs:", displayed)

    return logs

# =========================
# EVALUATION
# =========================
def precision_at_k(displayed: List[str], relevant: Set[str], k: int) -> float:
    if not displayed:
        return 0.0
    return len(set(displayed[:k]) & relevant) / k

def recall_at_k(displayed: List[str], relevant: Set[str], k: int) -> float:
    if not relevant:
        return 0.0
    return len(set(displayed[:k]) & relevant) / len(relevant)

def hit_rate(displayed: List[str], relevant: Set[str]) -> int:
    return int(bool(set(displayed) & relevant))

def evaluate(logs: List[Dict]) -> None:
    p_sum = r_sum = h_sum = 0.0
    n = 0

    for log in logs:
        user = mongo.find_one({"uid": log["user_id"]})
        if not user:
            continue

        gt = get_ground_truth(user, log["timestamp"])
        if not gt:
            continue

        disp = log["displayed_ids"]

        p_sum += precision_at_k(disp, gt, TOP_K)
        r_sum += recall_at_k(disp, gt, TOP_K)
        h_sum += hit_rate(disp, gt)
        n += 1

    if n == 0:
        print("❌ NO VALID USERS")
        return

    print("=" * 60)
    print("ONLINE EVALUATION RESULTS")
    print("=" * 60)
    print(f"Users evaluated: {n}")
    print(f"Precision@{TOP_K}: {p_sum / n:.4f}")
    print(f"Recall@{TOP_K}:    {r_sum / n:.4f}")
    print(f"Hit Rate:          {h_sum / n:.4f}")
    print("=" * 60)

# =========================
# MAIN
# =========================
if __name__ == "__main__":
    print("Starting evaluation...")
    cutoff = datetime.now(timezone.utc)

    logs = generate_logs(cutoff)
    print(f"Generated {len(logs)} logs")

    evaluate(logs)
