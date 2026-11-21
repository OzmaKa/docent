import logging

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from schemas.models import IngestURLRequest, IngestResponse
from services.ingest_service import ingest_url, ingest_file

router = APIRouter()
logger = logging.getLogger(__name__)

GENERIC_ERROR = "Something went wrong while processing your request. Please try again."


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
    except ValueError as e:
        # user-caused errors (bad URL, unsupported file type) -> 400, not 500
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        # full traceback goes to the server logs, the client gets a generic message
        logger.exception("Unexpected error in /ingest/url")
        raise HTTPException(status_code=500, detail=GENERIC_ERROR)


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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Unexpected error in /ingest/file")
        raise HTTPException(status_code=500, detail=GENERIC_ERROR)