from fastapi import FastAPI
from api.search import router as search_router

app = FastAPI(title="FinCommerce Engine")

app.include_router(search_router)

@app.get("/")
def health():
    return {"status": "ok"}
