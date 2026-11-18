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
    embeddings = get_embeddings()
    vectorstore = PineconeVectorStore(
        index_name="doc-assistant",
        embedding=embeddings,
        namespace=namespace,
        pinecone_api_key=os.getenv("PINECONE_API_KEY")
    )
    vectorstore.add_documents(docs)
    return len(docs)


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
    owner, repo = parse_github_repo_url(url)
    raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/main/README.md"

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
        response = await client.get(raw_url)

    if response.status_code != 200:
        raise ValueError(f"Could not fetch README from {owner}/{repo} (branch: main)")

    docs = chunk_text(response.text)
    return store_in_pinecone(docs, namespace=name)


async def ingest_file(file, name: str) -> int:
    content = await file.read()

    if file.content_type == "application/pdf":
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
        text = "\n".join([
            page.extract_text()
            for page in pdf_reader.pages
            if page.extract_text()
        ])
    elif file.content_type in ["text/plain", "text/markdown"]:
        text = content.decode("utf-8")
    else:
        raise ValueError(f"Unsupported file type: {file.content_type}")

    docs = chunk_text(text)
    return store_in_pinecone(docs, namespace=name)