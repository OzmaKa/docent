# Docent

**Ask questions about any public GitHub repo or document, and get answers grounded in its content.**

🌐 **Live demo:** https://docent-docs.web.app/

> The backend runs on a free tier and sleeps after 15 minutes of inactivity. The first request can take around 50 seconds to wake it up.

Docent is an agentic RAG (retrieval-augmented generation) app. You give it a GitHub repo URL or a file (PDF, TXT, or Markdown), it indexes the content, and then an agent searches that content to answer your questions. You can pick the LLM provider for each question.

## Features

- Ingest a public GitHub repo (reads its `README.md`) or upload a `.pdf`, `.txt`, or `.md` file
- Agentic retrieval: a LangGraph ReAct agent decides when to call a `search_docs` tool over the vector store
- Per-question provider choice: Cohere, Groq, or Gemini, behind one provider-agnostic factory
- Server-sent events (SSE) chat UI with a source preview for each answer
- Responsive dark UI (React, TypeScript, Tailwind)
- LangSmith tracing for inspecting retrieval and agent steps

## Architecture

```
React + Vite (Firebase Hosting)
        │  HTTPS / SSE
        ▼
FastAPI (Render)
   ├── /ingest/url, /ingest/file → chunk (500 / 50 overlap) → Cohere embeddings → Pinecone
   └── /query/query, /query/stream → LangGraph ReAct agent → search_docs (k=3) → LLM
```

| Layer | Tech |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | FastAPI, Python 3.12 |
| Orchestration | LangChain, LangGraph |
| Embeddings | Cohere `embed-english-v3.0` (1024 dimensions) |
| Vector store | Pinecone (serverless, cosine, one namespace per source) |
| LLM providers | Cohere, Groq, Google Gemini |
| Observability | LangSmith |
| Hosting | Firebase Hosting (frontend), Render (backend) |

## Project structure

```
backend/
├── main.py                  # app, CORS, routers, /health, startup
├── routes/
│   ├── ingest.py            # POST /ingest/url, POST /ingest/file
│   └── query.py             # POST /query/query, POST /query/stream
├── services/
│   ├── llm_factory.py       # get_llm(provider, model), get_embeddings()
│   ├── ingest_service.py    # validation, chunking, Pinecone upsert
│   └── rag_service.py       # agent construction and query logic
└── schemas/models.py        # Pydantic request/response models
frontend/
└── src/                     # App, Header, Sidebar, ChatPanel, api/
```

## Run locally

**Requirements:** Python 3.12, Node.js, and accounts for Pinecone, Cohere, and at least one LLM provider.

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (cmd)
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
```

Create `backend/.env` (never commit this file):

```
COHERE_API_KEY=
PINECONE_API_KEY=
GROQ_API_KEY=
GOOGLE_API_KEY=
DEFAULT_PROVIDER=
DEFAULT_MODEL=
# optional tracing
LANGCHAIN_API_KEY=
LANGCHAIN_TRACING_V2=
LANGCHAIN_PROJECT=
```

Start the server:

```bash
python -m uvicorn main:app --reload
```

The API runs on `http://127.0.0.1:8000` and the interactive docs are at `/docs`.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env` with the backend address:

```
VITE_API_URL=http://127.0.0.1:8000
```

```bash
npm run dev
```

The dev server runs on `http://localhost:3000`.

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/ingest/url` | Ingest a GitHub repo. Body: `{"url": "...", "name": "..."}` |
| `POST` | `/ingest/file` | Upload a `.pdf`, `.txt`, or `.md` file (max 5 MB), form fields `file` and `name` |
| `POST` | `/query/query` | Ask a question, returns the full answer |
| `POST` | `/query/stream` | Ask a question, returns an SSE stream |

## Security

- **SSRF protection on URL ingestion.** Only `https://github.com/<owner>/<repo>` URLs are accepted. The hostname is parsed and checked, `owner` and `repo` are validated with strict patterns, and the outgoing request URL is built server-side on `raw.githubusercontent.com`, so users never control the destination host.
- **Upload limits.** 5 MB cap, extension and content type must agree, and corrupt PDFs return a clear `400` instead of a `500`.
- Secrets are loaded from environment variables and excluded from git.

## Known limitations

This is an actively developed project. These are known gaps, not hidden ones:

- **No authentication or per-user isolation.** The namespace is derived from the name the user types, so anyone who knows a name can query it.
- **Namespace names must be ASCII.** Pinecone rejects non-ASCII names, so Arabic (or other non-Latin) names fail, and the error message is not user-friendly yet.
- **Sources list is client-side only.** It is lost on page refresh.
- **No source deletion.** Re-ingesting the same source duplicates its vectors.
- **GitHub ingestion reads only `README.md` from the `main` branch.** Repos using `master`, or with content in `docs/`, are not covered.
- **Ingestion is synchronous.** Large files hold the request open.
- **"Streaming" is simulated.** The agent runs to completion and the answer is then chunked word by word, because token-level streaming repeated content in the LangGraph loop.
- **No conversation memory.** Each question is answered independently.
- **No rate limiting, and CORS is open (`*`).**
- **No protection against prompt injection** through document content.
- **Answers render raw Markdown.** No rendering yet.
- **No retrieval evaluation, tests, or CI.**

## Roadmap

1. Close remaining security gaps: input limits, CORS restriction, rate limiting
2. Dockerize the backend
3. Postgres (Neon) with auth, per-user source isolation, and persisted sources
4. Retrieval evaluation set (50 to 100 questions) before any retrieval changes
5. Better ingestion: default-branch detection, `docs/` files, and citations with file path and heading
6. Background ingestion with job status, only if measurements show it is needed
7. Conversation memory, Markdown rendering, and fallback between providers

## Author

**Oussamah Kabalan** · [GitHub](https://github.com/OzmaKa) · [Portfolio](https://oussamah-kabalan.netlify.app)
