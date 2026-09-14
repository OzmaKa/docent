from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from schemas.models import IngestURLRequest, IngestResponse
from services.ingest_service import ingest_url, ingest_file

router = APIRouter()

@router.post("/url", response_model=IngestResponse)
async def ingest_url_endpoint(request: IngestURLRequest):
    try:
        chunk_count = await ingest_url(request.url, request.name)
        return IngestResponse(
            success=True,
            namespace=request.name,
            chunk_count=chunk_count,
            message=f"Successfully ingested {chunk_count} chunks from {request.url}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/file", response_model=IngestResponse)
async def ingest_file_endpoint(
    file: UploadFile = File(...),
    name: str = Form(...),
    provider: str = Form(None),
    model: str = Form(None)
):
    try:
        chunk_count = await ingest_file(file, name)
        return IngestResponse(
            success=True,
            namespace=name,
            chunk_count=chunk_count,
            message=f"Successfully ingested {chunk_count} chunks from {file.filename}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))