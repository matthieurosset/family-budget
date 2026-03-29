from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.import_routes import router as import_router
from app.config import settings

app = FastAPI(
    title="Family Budget Analyzer",
    description="Self-hosted family expense analyzer",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(import_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
