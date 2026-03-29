from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.categories_routes import router as categories_router
from app.api.dashboard_routes import router as dashboard_router
from app.api.envelope_routes import router as envelope_router
from app.api.import_routes import router as import_router
from app.api.transaction_routes import router as transaction_router
from app.config import settings

app = FastAPI(
    title="Family Budget Analyzer",
    description="Analyseur de dépenses familiales self-hosted",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(import_router)
app.include_router(categories_router)
app.include_router(dashboard_router)
app.include_router(envelope_router)
app.include_router(transaction_router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
