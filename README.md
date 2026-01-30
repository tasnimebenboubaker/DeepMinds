# VECTORS IN ORBIT

## Context-Aware FinCommerce Engine for Smart Discovery & Recommendations

**Team:** DeepMinds
**Members:** Tasnime Ben Boubaker · Emna Kallel · Maha Tlili
**Academic Year:** 2025–2026

---

## Project Overview & Objectives

This project delivers a **context-aware FinCommerce platform** that provides personalized product search and recommendations **while strictly enforcing users’ financial constraints** (budget, availability, payment methods).

### Problem

Most e-commerce systems prioritize popularity or generic relevance, frequently recommending items users cannot afford. This degrades trust, experience, and conversion.

### Solution

We combine **semantic understanding (vector embeddings)** with **hard financial and business constraints (structured filters)** to return only relevant *and affordable* products—improving discovery quality, user satisfaction, and conversion.

**Key objectives:**

* Financially responsible recommendations
* Hybrid semantic + keyword retrieval
* Personalized, diverse results
* Real-time performance with scalable vector infrastructure

---

## Platform Link

* **Web platform:** *Not publicly deployed / N/A*

---

## Technologies Used (with versions)

> Only versions explicitly used/tested are listed. Others are included without guessing versions.

**Backend & Data**

* FastAPI 
* MongoDB 
* Qdrant (Cloud)

**AI & Search**

* AllMini Embeddings: `text-embedding-3-small` (1536-dim)
* CLIP (for multimodal text+image embeddings; version not specified)
* BM25-style sparse retrieval (implementation-dependent)

**Synthetic Data Generation**

* PyTorch (version not specified)
* Diffusers
* Stable Diffusion **v1.5** (FP16, inference-only)

**Auth & Frontend**

* Firebase Authentication
* Web frontend (framework not specified)

---

## Project Structure / Architecture

### High-Level Architecture Diagram

```text
[ OrbitStore UI ]
        |
        v
[ FastAPI Backend ]
   |        |        |
   |        |        +--> Firebase Auth
   |        |
   |        +--> MongoDB (Users, Orders, Products)
   |
   +--> Qdrant Vector DB
        |-- Products Collection (text + image vectors, sparse BM25)
        |-- Users Collection (preference embeddings)
```

### Repository Structure

```
├── backend/
│ ├── __pycache__/ # Python cache 
│ ├── config.py # Environment variables & global config
│ ├── system-evaluation/
| ├── __pycache__/ # Python cache 
│ │ ├── offline_evaluation.py # Precision@K, Recall@K, hybrid search eval
│ │ └── online_evaluation.py # CTR, add-to-cart, constraint checks
│ ├── mongotoqdrant.py # MongoDB → Qdrant sync + hybrid retrieval
│ └── main.py # FastAPI entry point (API routes)
│
├── synthetic_data_generation_notebook.ipynb
│ # Synthetic product image + metadata generation (Stable Diffusion)
│
├── frontend/
│ ├── app/
│ │ ├── account/ # User profile & preferences
│ │ ├── api/ # Frontend API calls
│ │ ├── checkout/ # Cart & payment flow
│ │ ├── components/ # Reusable UI components
│ │ ├── lib/ # Helpers & shared logic
│ │ ├── login/ # Authentication pages
│ │ ├── orders/ # Order history
│ │ ├── signup/ # User registration
│ │ ├── wishlist/ # Wishlist & preference signals
│ │ ├── App.tsx # Root React component
│ │ ├── layout.tsx # Global layout
│ │ └── page.tsx # Main landing page
│ ├── public/ # Static assets
│ ├── package.json # Frontend dependencies
│ ├── package-lock.json # Dependency lockfile
│ └── tsconfig.json # TypeScript configuration
│
└── README.md # Project documentation
```

---

## Detailed Qdrant Integration

### Why Qdrant?

Qdrant is used as the **core semantic retrieval engine**, enabling fast vector similarity search with strict payload-based filtering for financial constraints.

### Collections

#### 1. Products Collection

* **Vectors:**

  * Dense semantic embeddings (text)
  * Multimodal embeddings (text + image via CLIP)
  * Sparse vectors for BM25-style keyword matching
* **Payload (filters):**

  * price
  * availability
  * category
  * brand
  * material
  * supported_payment_methods
  * rating, review_count

#### 2. Users Collection

* **Vectors:**

  * Aggregated embeddings from purchase history and wishlist
* **Payload:**

  * user metadata (IDs only; constraints are *not* embedded)

### Core Principles

* **Embeddings = relevance only**
* **Payloads = hard constraints** (budget, availability, payment method)
* No financial data is ever embedded

### Core Flow

1. User sends query or requests recommendations via OrbitStore UI
2. FastAPI backend:

   * Extracts intent and constraints
   * Generates embeddings
3. Qdrant:

   * Performs semantic similarity search
   * Applies payload filters (budget, availability, etc.)
4. Backend reranks results using personalization, MMR, and quality signals
5. Only constraint-compliant products are returned

---

## Search & Recommendation Pipelines

### Query-Based Search

1. **Availability filter** (early pruning)
2. **Hybrid retrieval**

   * Dense embeddings (semantic meaning)
   * BM25-style sparse retrieval (exact terms)
3. **Budget filter**
4. **Preference filter** (category, brand, material)
5. **Payment method filter**
6. **MMR diversification** (λ = 0.7)
7. **Custom reranking**

**Final score:**

```
semantic_score + 0.1 × rating + 0.001 × review_count
```

8. **Top-K results returned** (UX-driven precision)

---

### Query-Free Personalized Recommendations

1. Retrieve user profile from MongoDB
2. Generate user embedding (OpenAI)
3. Retrieve top 100 candidates from Qdrant
4. Apply hard constraints
5. MMR diversification
6. Quality-aware reranking

---

## Synthetic Data Generation Pipeline

* **Model:** Stable Diffusion v1.5 (FP16, GPU)
* **Products generated:** 200
* **Assets:**

  * One product image per item
  * Structured metadata (CSV + JSON)

**Steps:**

1. Attribute definition (category, brand, material)
2. Text metadata generation (templates)
3. Prompt engineering (studio lighting, white background)
4. Image synthesis
5. Structured data assembly
6. Dataset export

---

## Setup & Installation (Reproducibility)

### Prerequisites

* Python 3.9+
* GPU with CUDA (recommended for data generation)
* MongoDB instance
* Qdrant Cloud instance
* Firebase project

### Requirements File

All Python dependencies are listed in **requirements.txt**.

Example (excerpt):

```
fastapi
uvicorn
pymongo
qdrant-client
torch
diffusers
pandas
firebase-admin
```

### Environment Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Environment Variables

```bash

QDRANT_URL=...
QDRANT_API_KEY=...
MONGODB_URI=...
FIREBASE_CREDENTIALS=...
Azure storage account
```

### Data Generation

```bash
python data_generation/generate_images.py
python data_generation/export_dataset.py
```

### Backend

```bash
uvicorn backend.main:app --reload
```

---

## Usage Examples

### Search Products

```
POST /search
{
  "query": "running shoes",
  "budget": [50, 120],
  "payment_method": "credit_card"
}
```

### Personalized Recommendations

```
GET /recommendations/{user_id}
```

---

## Evaluation Methods

### Offline

* Precision@K
* Recall@K
* Hybrid retrieval comparison

### Online

* CTR
* Add-to-Cart Rate
* Constraint violation rate
* A/B testing (MMR λ, reranking weights)

---

## Project Timeline

### Completed

* Concept & system design
* Web platform
* Synthetic dataset generation
* MongoDB + Qdrant integration
* Dense & sparse embeddings
* Full online evaluation
* Ranking optimization
* Performance benchmarking
* Cold-start mitigation improvements

---

## Code Organization & Quality

* All production code is located in the ** master branch only**
* Modular separation ( evaluation, data generation)
* Complex logic (MMR, hybrid retrieval, reranking) is **explicitly commented**
* Clear naming conventions and single-responsibility modules

---

## License


