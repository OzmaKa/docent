from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from schemas.models import QueryRequest, QueryResponse
from services.rag_service import query_documents, stream_query_documents

router = APIRouter()

# ── Non-streaming endpoint — kept for simple integrations / testing ──────────
@router.post("/query", response_model=QueryResponse)
async def query_endpoint(request: QueryRequest):
    try:
        result = await query_documents(
            request.question,
            request.namespace,
            request.provider,
            request.model
        )
        return QueryResponse(
            answer=result["answer"],
            sources=result["sources"]
        )
    except Exception as e:
        print(f"QUERY ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Streaming endpoint — SSE, used by the chat UI ─────────────────────────────
@router.post("/stream")
async def query_stream_endpoint(request: QueryRequest):
    return StreamingResponse(
        stream_query_documents(
            request.question,
            request.namespace,
            request.provider,
            request.model
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )