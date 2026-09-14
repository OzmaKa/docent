from langchain_pinecone import PineconeVectorStore
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from services.llm_factory import get_llm, get_embeddings
import os
import json


def _normalize_answer(raw_answer):
    """Some providers (e.g. Gemini) return content as a list of content
    blocks instead of a plain string. Cohere and Groq return plain strings.
    Handle both shapes consistently."""
    if isinstance(raw_answer, list):
        return "\n".join([
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in raw_answer
        ])
    return raw_answer


def _build_agent(namespace: str, provider: str, model: str):
    vectorstore = PineconeVectorStore(
        index_name="doc-assistant",
        embedding=get_embeddings(),
        namespace=namespace,
        pinecone_api_key=os.getenv("PINECONE_API_KEY")
    )
    retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
    sources = []

    @tool
    def search_docs(query: str) -> str:
        """Search the ingested documentation for information relevant to the query.
        ALWAYS use this tool first for any question about the document content,
        including questions about what the file contains, describes, or exposes.
        You already have access to the document through this tool — never ask
        the user to provide the file themselves."""
        docs = retriever.invoke(query)
        sources.extend([doc.page_content[:150] for doc in docs])
        return "\n\n".join([doc.page_content for doc in docs])

    llm = get_llm(provider=provider, model=model)
    agent = create_react_agent(
        llm,
        [search_docs],
        prompt=(
            "You are a documentation assistant with access to an ingested document "
            "through the search_docs tool. For ANY question about the document's "
            "content — including what it contains, explains, or exposes — always "
            "call search_docs first before answering. Never ask the user to provide "
            "the file; you already have access to it via the tool. Base your answer "
            "only on what search_docs returns."
        )
    )
    return agent, sources


# ── Non-streaming version — used as fallback / by /query/query ───────────────
async def query_documents(
    question: str,
    namespace: str,
    provider: str = None,
    model: str = None
) -> dict:
    agent, sources = _build_agent(namespace, provider, model)

    try:
        result = agent.invoke({"messages": [("human", question)]})
        answer = _normalize_answer(result["messages"][-1].content)
    except Exception as e:
        err = str(e)
        if "RESOURCE_EXHAUSTED" in err or "429" in err:
            return {
                "answer": "This provider hit its rate limit. Try again in a few seconds or switch providers.",
                "sources": []
            }
        raise

    return {
        "answer": answer,
        "sources": list(set(sources))
    }


# ── Streaming version — NON-STREAMING UNDER THE HOOD, chunked for typing effect
#
# Why: create_react_agent's token-level astream re-emits full accumulated
# content at multiple points in the tool-calling loop (once per reasoning
# step), which caused visible triplication of the same answer. Rather than
# fight LangGraph's internal streaming semantics, we run the agent to
# completion (same as the reliable non-streaming path), then simulate a
# typing effect by yielding the final answer in small word chunks. This
# guarantees correctness first; true token-level streaming can be revisited
# later using a lower-level LangChain streaming API if needed.
async def stream_query_documents(
    question: str,
    namespace: str,
    provider: str = None,
    model: str = None
):
    agent, sources = _build_agent(namespace, provider, model)

    try:
        result = agent.invoke({"messages": [("human", question)]})
        answer = _normalize_answer(result["messages"][-1].content)
    except Exception as e:
        err = str(e)
        if "RESOURCE_EXHAUSTED" in err or "429" in err:
            msg = "This provider hit its rate limit. Try again in a few seconds or switch providers."
        else:
            msg = f"Error: {err}"
        yield f"data: {json.dumps({'type': 'error', 'content': msg})}\n\n"
        return

    # simulate streaming by chunking the final, correct answer word by word
    words = answer.split(" ")
    for i, word in enumerate(words):
        chunk = word + (" " if i < len(words) - 1 else "")
        yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"

    yield f"data: {json.dumps({'type': 'sources', 'sources': list(set(sources))})}\n\n"
    yield f"data: {json.dumps({'type': 'done'})}\n\n"