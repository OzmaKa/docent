from pydantic import BaseModel
from typing import Optional

class IngestURLRequest(BaseModel):
    # url, name, optional provider/model override
    url: str
    name: str
    provider: Optional[str] = None
    model: Optional[str] = None

class IngestResponse(BaseModel):
    # what comes back after ingesting — success message, namespace, chunk count
    success: bool
    namespace: str
    chunk_count: int
    message: str
class QueryRequest(BaseModel):
    # question, which namespace to search, optional provider/model override
    question: str
    namespace: str
    provider: Optional[str] = None
    model: Optional[str] = None
class QueryResponse(BaseModel):
    # the answer, which sources were used
    answer: str
    sources: list[str]