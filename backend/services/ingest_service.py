import asyncio
import httpx
import PyPDF2
import io
import os
import re
from urllib.parse import urlparse
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore
from langchain_core.documents import Document
from services.llm_factory import get_embeddings
from pinecone import Pinecone, ServerlessSpec

_OWNER_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
_REPO_RE = re.compile(r"^[A-Za-z0-9._-]{1,100}$")

# Pinecone namespaces must be ASCII. TEMPORARY rule until namespaces become
# server-generated IDs (user-facing names will then be stored separately).
# The 64-char cap is a conservative choice of ours, not a documented Pinecone limit.
_SOURCE_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$")

MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
_ALLOWED_TYPES = {
    ".pdf": ["application/pdf"],
    ".txt": ["text/plain"],
    ".md": ["text/markdown", "text/plain"],
}


def get_pinecone_index():
    pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
    index_name = "doc-assistant"

    # create index if it doesn't exist
    if index_name not in pc.list_indexes().names():
        pc.create_index(
            name=index_name,
            dimension=1024,  # Cohere embed-english-v3.0 dimension
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1")
        )
    return pc.Index(index_name)


def chunk_text(text: str) -> list[Document]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    return splitter.create_documents([text])


def store_in_pinecone(docs: list[Document], namespace: str) -> int:
    """BLOCKING (embeddings + Pinecone network calls). From async code, call it
    through asyncio.to_thread so the event loop stays free."""
    embeddings = get_embeddings()
    vectorstore = PineconeVectorStore(
        index_name="doc-assistant",
        embedding=embeddings,
        namespace=namespace,
        pinecone_api_key=os.getenv("PINECONE_API_KEY")
    )
    vectorstore.add_documents(docs)
    return len(docs)


def validate_source_name(name: str) -> None:
    """Reject names Pinecone can't accept, with a clear message (-> HTTP 400)."""
    if not _SOURCE_NAME_RE.match(name or ""):
        raise ValueError(
            "Source name must use English letters, numbers, spaces, '-', '_' or '.', "
            "start with a letter or number, and be at most 64 characters. "
            "Non-English names are not supported yet."
        )


def parse_github_repo_url(url: str) -> tuple[str, str]:
    """Validate a GitHub repo URL and return (owner, repo).

    We never reuse the user's URL for the outgoing request: we only extract
    owner and repo (after validating their shape) and build the real URL
    ourselves. The user can't control the destination host.
    """
    parsed = urlparse(url.strip())

    # hostname gives the real domain, even with "user@" or a port in the URL
    if parsed.scheme != "https" or parsed.hostname != "github.com":
        raise ValueError("Only https://github.com/<owner>/<repo> URLs are supported")

    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) < 2:
        raise ValueError("URL must look like https://github.com/<owner>/<repo>")

    owner, repo = parts[0], parts[1]
    if repo.endswith(".git"):
        repo = repo[:-4]

    if not _OWNER_RE.match(owner) or not _REPO_RE.match(repo) or repo in (".", ".."):
        raise ValueError("Invalid GitHub owner or repo name")

    return owner, repo


async def ingest_url(url: str, name: str) -> int:
    validate_source_name(name)
    owner, repo = parse_github_repo_url(url)
    raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/main/README.md"

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
        response = await client.get(raw_url)

    if response.status_code != 200:
        raise ValueError(f"Could not fetch README from {owner}/{repo} (branch: main)")

    docs = chunk_text(response.text)
    return await asyncio.to_thread(store_in_pinecone, docs, name)


def _validate_file_type(filename: str | None, content_type: str | None) -> str:
    """Return the file extension if both extension and content_type are allowed."""
    ext = os.path.splitext((filename or "").lower())[1]
    if ext not in _ALLOWED_TYPES:
        raise ValueError("Unsupported file type. Allowed: .pdf, .txt, .md")
    if content_type not in _ALLOWED_TYPES[ext]:
        raise ValueError(f"File content type '{content_type}' does not match '{ext}'")
    return ext


def _extract_pdf_text(content: bytes) -> str:
    """BLOCKING and CPU-bound: parsing a large PDF can take seconds."""
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(content))
        pages = [page.extract_text() for page in reader.pages]
    except Exception:
        # corrupted / encrypted / malformed PDF -> a user error, not a server bug
        raise ValueError("Could not read this PDF. It may be corrupted or encrypted.")
    return "\n".join(p for p in pages if p)


async def ingest_file(file, name: str) -> int:
    validate_source_name(name)
    ext = _validate_file_type(file.filename, file.content_type)

    # read at most MAX+1 bytes: if we get more than MAX, the file is too big
    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise ValueError(f"File too large. Maximum size is {MAX_FILE_BYTES // (1024 * 1024)} MB")

    if ext == ".pdf":
        text = await asyncio.to_thread(_extract_pdf_text, content)
    else:
        text = content.decode("utf-8")  # UnicodeDecodeError is a ValueError -> 400

    if not text.strip():
        raise ValueError("No readable text found in this file")

    docs = chunk_text(text)
    return await asyncio.to_thread(store_in_pinecone, docs, name)