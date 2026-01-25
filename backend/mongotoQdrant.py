from pymongo import MongoClient
from openai import OpenAI
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
import torch
import requests
from io import BytesIO
import uuid
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# --- 1️⃣ Connect to MongoDB ---
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("DB_NAME", "DataBaseDM")

if not MONGODB_URI:
    raise ValueError("MONGODB_URI environment variable is not set")

client = MongoClient(MONGODB_URI)
db = client[DB_NAME]
collection = db["Products"]

# --- 2️⃣ Generate TEXT embeddings (dense) using OpenAI ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is not set")

openai_client = OpenAI(api_key=OPENAI_API_KEY)
documents = list(collection.find({}))
texts = [doc.get("description", "") for doc in documents if doc.get("description")]

# Get embeddings from OpenAI API
response = openai_client.embeddings.create(
    model="text-embedding-3-small",
    input=texts
)

dense_embeddings = [item.embedding for item in response.data]
TEXT_VECTOR_SIZE = len(dense_embeddings[0])  # dimension text (1536 for text-embedding-3-small)

# --- 3️⃣ Generate TEXT sparse embeddings (TF-IDF) ---
tfidf_vectorizer = TfidfVectorizer(max_features=5000)  # ajustable
sparse_matrix = tfidf_vectorizer.fit_transform(texts)
sparse_indices_list = []
sparse_values_list = []

for row in sparse_matrix:
    # row est un scipy.sparse row
    row = row.tocoo()
    sparse_indices_list.append(row.col.tolist())
    sparse_values_list.append(row.data.tolist())

# --- 4️⃣ Image embeddings model ---
clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
IMAGE_VECTOR_SIZE = clip_model.config.vision_config.hidden_size  # 512

# Combined vector size (text + image)
COMBINED_VECTOR_SIZE = TEXT_VECTOR_SIZE + IMAGE_VECTOR_SIZE  # 1536 + 512 = 2048

# --- 5️⃣ Connect to Qdrant ---
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

if not QDRANT_URL or not QDRANT_API_KEY:
    raise ValueError("QDRANT_URL and QDRANT_API_KEY environment variables are required")

qdrant = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
    timeout=60  # Increase timeout to 60 seconds
)

# --- 6️⃣ Recreate collection ---
try:
    qdrant.delete_collection("Products")
except:
    pass

qdrant.create_collection(
    collection_name="Products",
    vectors_config={
        "combined_vector": VectorParams(size=COMBINED_VECTOR_SIZE, distance=Distance.COSINE)
    },
    sparse_vectors_config={
        "text_sparse": SparseVectorParams()
    }
)
print(f"Collection created with combined text+image vector ({COMBINED_VECTOR_SIZE} dimensions) and sparse text vectors")

# --- 7️⃣ Prepare points ---
points = []

for idx, doc in enumerate(documents):
    description = doc.get("description")
    if not description:
        continue

    # --- Dense vector (text from OpenAI) ---
    text_vector = dense_embeddings[idx].tolist()

    # --- Sparse vector ---
    sparse_vector = SparseVector(
        indices=sparse_indices_list[idx],
        values=sparse_values_list[idx]
    )

    # --- Image vector ---
    image_vector = [0.0] * IMAGE_VECTOR_SIZE
    image_url = doc.get("image_url")
    if image_url:
        try:
            response = requests.get(image_url)
            image = Image.open(BytesIO(response.content)).convert("RGB")
            inputs = clip_processor(images=image, return_tensors="pt")
            with torch.no_grad():
                img_emb = clip_model.get_image_features(**inputs)
            image_vector = img_emb[0].numpy().tolist()
        except Exception as e:
            print(f"Impossible de traiter l'image {image_url}: {e}")

    # --- Combine text and image vectors into one ---
    combined_vector = text_vector + image_vector

    # --- Point ---
    # Extract nested rating fields
    rating_obj = doc.get("rating", {})
    rate = float(rating_obj.get("rate", 0.0)) if isinstance(rating_obj, dict) else 0.0
    review_count = int(rating_obj.get("count", 0)) if isinstance(rating_obj, dict) else 0
    
    point = PointStruct(
        id=idx,
        vector={
            "combined_vector": combined_vector,
            "text_sparse": sparse_vector
        },
        payload={
            "category": doc.get("category", ""),
            "rate": rate,
            "review_count": review_count,
            "product_id": str(doc.get("id", uuid.uuid4())),
            "payment_methods": doc.get("payment_methods", []),
            "availability": bool(doc.get("availability", True)),
            "price": float(doc.get("price", 0.0))
        }
    )
    points.append(point)

# --- 8️⃣ Upload points to Qdrant (in batches) ---
batch_size = 50  # Upload in batches of 50 points
for i in range(0, len(points), batch_size):
    batch = points[i:i+batch_size]
    try:
        qdrant.upsert(
            collection_name="Products",
            points=batch
        )
        print(f"Uploaded batch {i//batch_size + 1}/{(len(points) + batch_size - 1)//batch_size}")
    except Exception as e:
        print(f"Error uploading batch: {e}")
        continue

print("Data successfully uploaded with dense + sparse text vectors and image vectors!")
