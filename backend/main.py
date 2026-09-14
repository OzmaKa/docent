from routes.ingest import router as ingest_router
from routes.query import router as query_router
from services.ingest_service import get_pinecone_index
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Doc Assistant API")

@app.on_event("startup")
async def startup_event():
    get_pinecone_index()
    print("Pinecone index ready")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# mount routes

app.include_router(ingest_router, prefix="/ingest", tags=["ingest"])
app.include_router(query_router, prefix="/query", tags=["query"])

# health check
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# run with: uvicorn main:app --reload