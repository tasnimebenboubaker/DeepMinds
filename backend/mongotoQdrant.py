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
from rank_bm25 import BM25Okapi
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

# --- 3️⃣ Generate TEXT sparse embeddings (BM25) ---
# Tokenize documents for BM25
tokenized_texts = [text.lower().split() for text in texts]
bm25 = BM25Okapi(tokenized_texts)

# Create BM25 sparse vectors for Qdrant
sparse_indices_list = []
sparse_values_list = []
vocab_to_idx = {}
idx_counter = 0

# Build vocabulary from BM25 IDF
for token in bm25.idf.keys():
    vocab_to_idx[token] = idx_counter
    idx_counter += 1

# Generate sparse vectors for each document
for i, tokens in enumerate(tokenized_texts):
    doc_indices = []
    doc_scores = []
    
    # Get unique tokens in this document
    unique_tokens = set(tokens)
    for token in unique_tokens:
        if token in vocab_to_idx:
            # Calculate BM25 score for this token in this document
            token_indices = [j for j, t in enumerate(tokens) if t == token]
            if token_indices:
                idf = bm25.idf.get(token, 0.0)
                token_freq = len(token_indices)
                avg_doc_length = sum(len(doc) for doc in tokenized_texts) / len(tokenized_texts)
                k1 = 1.5
                b = 0.75
                numerator = idf * token_freq * (k1 + 1)
                denominator = token_freq + k1 * (1 - b + b * (len(tokens) / avg_doc_length))
                bm25_score = numerator / denominator if denominator > 0 else 0.0
                
                doc_indices.append(vocab_to_idx[token])
                doc_scores.append(bm25_score)
    
    sparse_indices_list.append(doc_indices)
    sparse_values_list.append(doc_scores)

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
print(f"Collection created with combined text+image vector ({COMBINED_VECTOR_SIZE} dimensions) and BM25 sparse text vectors")

# --- Helper functions for extracting brand and material from title ---
def extract_brand_from_title(title: str, category: str = None) -> str:
    """
    Extract brand from product title based on various formats
    Clothing: "{brand} {product_type} in {material}" -> "Nike"
    Jewelry: "{material} {product_type} by {brand}" -> "brand" (after " by ")
    Electronics: "{brand} {product_type} with {material} finish" -> "Nike"
    Home Appliances: "{brand} {product_type} with {material} design" -> "Brand"
    Sports: "{brand} {product_type} for sports..." -> "Nike"
    """
    if not title:
        return ""
    
    # Jewelry format: "{material} {product_type} by {brand}"
    if category == "Jewelery" or " by " in title:
        by_index = title.find(" by ")
        if by_index != -1:
            return title[by_index + 4:].strip().split()[0]  # First word after " by "
    
    # Default: first word is the brand (works for Clothing, Electronics, Home Appliances, Sports)
    parts = title.split()
    return parts[0] if parts else ""


def extract_material_from_title(title: str, category: str = None) -> str:
    """
    Extract material from product title based on various formats
    Clothing: "{brand} {product_type} in {material}" -> "Leather"
    Jewelry: "{material} {product_type} by {brand}" -> "Gold" (first word)
    Electronics: "{brand} {product_type} with {material} finish" -> "Aluminum"
    Home Appliances: "{brand} {product_type} with {material} design" -> "Stainless Steel"
    Sports: "{brand} {product_type} for sports..." -> "" (no material)
    """
    if not title:
        return ""
    
    # Jewelry format: "{material} {product_type} by {brand}" - material is first word
    if category == "Jewelery" or (" by " in title and " in " not in title):
        parts = title.split()
        return parts[0] if parts else ""
    
    # Clothing format: "{brand} {product_type} in {material}"
    if " in " in title:
        in_index = title.find(" in ")
        return title[in_index + 4:].strip()
    
    # Electronics/Home Appliances format: "{brand} {product_type} with {material} (finish|design)"
    if " with " in title:
        with_index = title.find(" with ")
        after_with = title[with_index + 6:].strip()
        
        # Remove trailing "finish" or "design"
        finish_index = after_with.find(" finish")
        design_index = after_with.find(" design")
        
        if finish_index != -1:
            return after_with[:finish_index].strip()
        elif design_index != -1:
            return after_with[:design_index].strip()
        
        return after_with
    
    # Sports & Outdoors or other: no material
    return ""


# --- 7️⃣ Prepare points ---
points = []
embedding_idx = 0  # Track index in embeddings list

for doc_idx, doc in enumerate(documents):
    description = doc.get("description")
    if not description:
        continue

    # --- Dense vector (text from OpenAI) ---
    # dense_embeddings is already a list of lists
    text_vector = dense_embeddings[embedding_idx] if isinstance(dense_embeddings[embedding_idx], list) else dense_embeddings[embedding_idx].tolist()

    # --- Sparse vector ---
    sparse_vector = SparseVector(
        indices=sparse_indices_list[embedding_idx],
        values=sparse_values_list[embedding_idx]
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

    # --- Combined text and image vectors into one ---
    combined_vector = text_vector + image_vector

    # --- Extract brand and material from title ---
    title = doc.get("title", "")
    category = doc.get("category", "")
    brand = extract_brand_from_title(title, category)
    material = extract_material_from_title(title, category)

    # --- Point ---
    # Extract nested rating fields
    rating_obj = doc.get("rating", {})
    rate = float(rating_obj.get("rate", 0.0)) if isinstance(rating_obj, dict) else 0.0
    review_count = int(rating_obj.get("count", 0)) if isinstance(rating_obj, dict) else 0
    
    point = PointStruct(
        id=doc_idx,
        vector={
            "combined_vector": combined_vector,
            "text_sparse": sparse_vector
        },
        payload={
            "category": doc.get("category", ""),
            "brand": brand,
            "material": material,
            "rate": rate,
            "review_count": review_count,
            "product_id": str(doc.get("id", uuid.uuid4())),
            "payment_methods": doc.get("payment_methods", []),
            "availability": bool(doc.get("availability", True)),
            "price": float(doc.get("price", 0.0))
        }
    )
    points.append(point)
    
    # Increment embedding index only for documents with descriptions
    embedding_idx += 1

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

print("Data successfully uploaded with dense + BM25 sparse text vectors and image vectors!")

# --- 9️⃣ Populate Users collection with user embeddings from MongoDB ---
print("\nPopulating users collection...")

# Create users collection
try:
    qdrant.delete_collection("users")
except:
    pass

qdrant.create_collection(
    collection_name="users",
    vectors_config={
        "user_embedding": VectorParams(size=TEXT_VECTOR_SIZE, distance=Distance.COSINE)
    }
)

# Connect to MongoDB to fetch users
users_db = client["DataBaseDM"]
users_collection = users_db["users"]
all_users = list(users_collection.find({}))

def compute_user_embedding_text(user_doc):
    """Generate embedding text from user's purchases and wishlist"""
    text_parts = []
    
    # Add purchases
    if user_doc.get("purchases"):
        for purchase in user_doc["purchases"]:
            if purchase.get("items"):
                for item in purchase["items"]:
                    title = item.get("title", "")
                    category = item.get("category", "")
                    if title and category:
                        text_parts.append(f"{title} ({category})")
    
    # Add wishlist items
    if user_doc.get("wishlist"):
        for item in user_doc["wishlist"]:
            name = item.get("name", "")
            category = item.get("category", "")
            if name and category:
                text_parts.append(f"{name} ({category})")
    
    # If no items, use preference text
    if not text_parts:
        categories = user_doc.get("preferences", {}).get("categories", [])
        if categories:
            text_parts = [f"Interested in {cat}" for cat in categories]
    
    # Create embedding text
    embedding_text = " ".join(text_parts) if text_parts else "General user"
    return embedding_text

user_points = []
for user_idx, user_doc in enumerate(all_users):
    uid = user_doc.get("uid")
    if not uid:
        continue
    
    # Compute embedding text and encode
    embedding_text = compute_user_embedding_text(user_doc)
    user_embedding = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=embedding_text
    ).data[0].embedding
    
    # Create user point
    user_point = PointStruct(
        id=user_idx,
        vector={"user_embedding": user_embedding},
        payload={
            "user_id": uid,
            "preferredPaymentMethod": user_doc.get("preferredPaymentMethod", "card"),
            "budget_min": user_doc.get("budgetRange", {}).get("min", 0),
            "budget_max": user_doc.get("budgetRange", {}).get("max", 10000),
            "preferred_categories": user_doc.get("preferences", {}).get("categories", []),
            "preferred_brands": user_doc.get("preferences", {}).get("brands", []),
            "preferred_materials": user_doc.get("preferences", {}).get("materials", []),
            "last_updated": user_doc.get("updatedAt", ""),
        }
    )
    user_points.append(user_point)

# Upload user points in batches
if user_points:
    batch_size = 50
    for i in range(0, len(user_points), batch_size):
        batch = user_points[i:i+batch_size]
        try:
            qdrant.upsert(
                collection_name="users",
                points=batch
            )
            print(f"Uploaded user batch {i//batch_size + 1}/{(len(user_points) + batch_size - 1)//batch_size}")
        except Exception as e:
            print(f"Error uploading user batch: {e}")
            continue
    print(f"✅ Successfully uploaded {len(user_points)} users to Qdrant!")
else:
    print("⚠️ No users found in MongoDB")

print("\n✅ All data successfully synced to Qdrant!")
