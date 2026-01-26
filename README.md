# VECTORS IN ORBIT

## Context-Aware FinCommerce Engine for Smart Discovery & Recommendations

### Project Overview
This project aims to build a smart **FinCommerce recommendation and search engine** that delivers personalized product discovery while strictly respecting users’ financial constraints such as budget, availability, and payment methods.

Unlike traditional e-commerce systems that focus mainly on popularity or generic relevance, this system integrates **semantic understanding**, **user intent**, and **hard financial constraints** to improve trust, relevance, and user satisfaction.

The system is designed around **vector search**, **hybrid retrieval**, and **constraint-aware ranking**, with Qdrant Cloud as the core vector database.

---

## Problem Being Solved
Most e-commerce platforms recommend products without considering whether users can realistically afford them. This leads to:
- Poor user experience  
- Reduced trust  
- Lower conversion rates  

This project addresses the issue by enforcing **financial constraints as hard filters**, while still providing high-quality semantic and personalized recommendations.

---

## Tech Stack

### Backend
- **Python**
- **FastAPI** – Search and recommendation API
- **MongoDB** – Product metadata and structured storage
- **Qdrant Cloud** – Vector storage, similarity search, and payload-based filtering

### Embeddings & Search
- **Dense text embeddings (text-embedding-3-small from OPENAI)** 
- **Image embeddings (CLIP from OPENAI)**
- **Sparse text embeddings (BM25-style retrieval)**
- **Hybrid search (Dense + Sparse)**

### Data Generation
- **PyTorch**
- **Diffusers (Stable Diffusion v1.5)** – Synthetic product image generation
- **Pandas / JSON** – Dataset storage

### Frontend (OrbitStore Web Application)
- **NextJS** 
- **TailwindCss**
- **Firebase Authentication** 

---

## Setup & Run (Basic)

> Detailed setup will be added later.

General steps:
1. Clone the repository  
2. Install Python dependencies  
3. Set up MongoDB  
4. Configure Qdrant Cloud credentials  
5. Run the FastAPI backend  
6. Launch the OrbitStore frontend  

## Team

**Team Name:** DeepMinds  

**Team Members**
- Tasnime Ben Boubaker  
- Emna Kallel  
- Maha Tlili  
