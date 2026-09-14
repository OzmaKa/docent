import httpx
import PyPDF2
import io
import os
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore
from langchain_core.documents import Document
from services.llm_factory import get_embeddings
from pinecone import Pinecone, ServerlessSpec

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

async def ingest_url(url: str, name: str) -> int:
    # convert GitHub URL to raw README URL
    if "github.com" in url:
        parts = url.replace("https://github.com/", "").split("/")
        owner, repo = parts[0], parts[1]
        url = f"https://raw.githubusercontent.com/{owner}/{repo}/main/README.md"

    # fetch content
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        if response.status_code != 200:
            raise ValueError(f"Could not fetch URL: {url}")
        text = response.text

    # chunk and store
    docs = chunk_text(text)
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