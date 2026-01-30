from pymongo import MongoClient
from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    PointStruct,
    VectorParams,
    SparseVectorParams,
    Distance,
    SparseVector
)
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
from sentence_transformers import SentenceTransformer
import torch
import requests
from io import BytesIO
import uuid
from rank_bm25 import BM25Okapi
import os
from dotenv import load_dotenv
import numpy as np

# Load environment variables
load_dotenv()

# --- Initialize SentenceTransformer model ---
model = SentenceTransformer("all-MiniLM-L6-v2")
TEXT_VECTOR_SIZE = 384  # all-MiniLM-L6-v2 output dimension

# --- 1️⃣ MongoDB ---
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "DataBaseDM")

if not MONGODB_URI:
    raise ValueError("MONGODB_URI not set")

client = MongoClient(MONGODB_URI)
db = client[DB_NAME]
collection = db["Products"]

documents = list(collection.find({}))
texts = [
    f"{doc.get('title','')} {doc.get('category','')} {doc.get('description','')}"
    for doc in documents if doc.get("description")
]

# --- 2️⃣ Dense text embeddings (SentenceTransformer) ---
dense_embeddings = model.encode(texts, convert_to_tensor=False)
dense_embeddings = [e.tolist() if hasattr(e, 'tolist') else e for e in dense_embeddings]

# -----------------------------
# 3️⃣ BM25 sparse vectors
# -----------------------------
tokenized_texts = [t.lower().split() for t in texts]
bm25 = BM25Okapi(tokenized_texts)

vocab_to_idx = {token: i for i, token in enumerate(bm25.idf.keys())}

sparse_indices_list = []
sparse_values_list = []

avg_doc_length = sum(len(doc) for doc in tokenized_texts) / len(tokenized_texts)
k1, b = 1.5, 0.75

for tokens in tokenized_texts:
    indices, values = [], []
    for token in set(tokens):
        if token in vocab_to_idx:
            tf = tokens.count(token)
            idf = bm25.idf.get(token, 0.0)
            score = (idf * tf * (k1 + 1)) / (
                tf + k1 * (1 - b + b * (len(tokens) / avg_doc_length))
            )
            indices.append(vocab_to_idx[token])
            values.append(score)

    sparse_indices_list.append(indices)
    sparse_values_list.append(values)

# -----------------------------
# 4️⃣ CLIP image model
# -----------------------------
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
IMAGE_VECTOR_SIZE = clip_model.config.vision_config.hidden_size  # 512

COMBINED_VECTOR_SIZE = TEXT_VECTOR_SIZE + IMAGE_VECTOR_SIZE  # 384 + 512 = 896

# -----------------------------
# 5️⃣ Qdrant
# -----------------------------
qdrant = QdrantClient(
    url=os.getenv("QDRANT_URL"),
    api_key=os.getenv("QDRANT_API_KEY"),
    timeout=60
)

try:
    qdrant.delete_collection("Products")
except:
    pass

qdrant.create_collection(
    collection_name="Products",
    vectors_config={
        "combined_vector": VectorParams(
            size=COMBINED_VECTOR_SIZE,
            distance=Distance.COSINE
        )
    },
    sparse_vectors_config={
        "text_sparse": SparseVectorParams()
    }
)

# -----------------------------
# 6️⃣ Helpers
# -----------------------------
def extract_brand_from_title(title: str) -> str:
    return title.split()[0] if title else ""

def extract_material_from_title(title: str) -> str:
    if " in " in title:
        return title.split(" in ", 1)[1]
    return ""

# -----------------------------
# 7️⃣ Index products
# -----------------------------
points = []
embedding_idx = 0

for doc_idx, doc in enumerate(documents):
    if not doc.get("description"):
        continue

    text_vector = dense_embeddings[embedding_idx]
    sparse_vector = SparseVector(
        indices=sparse_indices_list[embedding_idx],
        values=sparse_values_list[embedding_idx]
    )

    image_vector = [0.0] * IMAGE_VECTOR_SIZE
    image_url = doc.get("image_url") or doc.get("image")

    if image_url:
        try:
            response = requests.get(image_url)
            image = Image.open(BytesIO(response.content)).convert("RGB")
            inputs = clip_processor(images=image, return_tensors="pt")
            with torch.no_grad():
                img_emb = clip_model.get_image_features(**inputs)
            image_vector = img_emb[0].tolist()
        except:
            pass

    combined_vector = text_vector + image_vector

    point = PointStruct(
        id=doc_idx,
        vector={
            "combined_vector": combined_vector,
            "text_sparse": sparse_vector
        },
        payload={
            "category": doc.get("category", ""),
            "brand": extract_brand_from_title(doc.get("title", "")),
            "material": extract_material_from_title(doc.get("title", "")),
            "price": float(doc.get("price", 0.0)),
            "product_id": str(doc.get("id", uuid.uuid4()))
        }
    )

    points.append(point)
    embedding_idx += 1

qdrant.upsert(collection_name="Products", points=points)

print("✅ Products indexed successfully")

# -----------------------------
# 8️⃣ Users collection
# -----------------------------
try:
    qdrant.delete_collection("users")
except:
    pass

qdrant.create_collection(
    collection_name="users",
    vectors_config={
        "user_embedding": VectorParams(
            size=TEXT_VECTOR_SIZE,
            distance=Distance.COSINE
        )
    }
)

users = list(client[DB_NAME]["users"].find({}))
user_points = []

for idx, user in enumerate(users):
    uid = user.get("uid")
    if not uid:
        continue

    text = " ".join(user.get("preferences", {}).get("categories", [])) or "General user"

    user_emb = model.encode(text, convert_to_tensor=False)
    if hasattr(user_emb, 'tolist'):
        user_emb = user_emb.tolist()

    user_points.append(
        PointStruct(
            id=idx,
            vector={"user_embedding": user_emb},
            payload={
                "user_id": uid,
                "preferences": user.get("preferences", {}),
                "budgetRange": user.get("budgetRange", {}),
                "preferredPaymentMethod": user.get("preferredPaymentMethod", "")
            }
        )
    )


if user_points:
    qdrant.upsert(collection_name="users", points=user_points)

print("✅ Users indexed successfully")
