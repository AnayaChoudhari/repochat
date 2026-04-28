# RepoChat

> Chat with any GitHub repository using AI. Ask questions about any codebase and get cited, accurate answers with exact file references.

## Overview

RepoChat is a full-stack Agentic RAG (Retrieval-Augmented Generation) application that lets developers onboard to any codebase instantly. Instead of spending days reading through unfamiliar code, you can ask natural language questions and get precise, cited answers grounded in the actual source files.

Built with a 4-agent LangGraph pipeline, semantic vector search, and a clean dark-themed React interface.

---

## Problem Statement

New engineers typically spend 1-2 weeks reading through an unfamiliar codebase before becoming productive. Existing tools like GitHub Copilot only assist with code completion — they cannot answer questions about a private, internal, or unfamiliar repository they have never seen. RepoChat solves this by indexing any repo on demand and enabling conversational Q&A with full source citations.

---

## Features

- **Multi-agent pipeline** - 4 specialized LangGraph agents handle retrieval, reasoning, citation and follow-up generation independently
- **Semantic search** — ChromaDB vector store with sentence-transformer embeddings for accurate chunk retrieval
- **Syntax highlighted answers** — Code blocks rendered with language-specific syntax highlighting
- **Cited sources** — Every answer includes exact file paths linked directly to GitHub
- **Follow-up suggestions** — Agent automatically generates 3 contextual follow-up questions after each answer
- **Edit messages** — Edit any previous question and rerun the conversation from that point, just like Claude
- **Per-repo chat history** — Each indexed repository maintains its own persistent conversation history
- **File-specific filtering** — Filter queries to a specific file for targeted answers
- **Multi-repo support** — Index and switch between multiple repositories in one session
- **Typing animation** — Streamed token-by-token response rendering
- **Indexing progress bar** — Real-time progress indicator with stage labels during indexing
- **Auto-scroll** — Chat automatically scrolls to latest message with a jump-to-bottom button
- **Copy answers** — One-click copy button on every AI response

---

## Architecture

```
User Query
    |
    v
Retrieval Agent (LangGraph)
    - Semantic search over ChromaDB vector store
    - Returns top-8 most relevant code chunks
    - Applies file filter if specified
    |
    v
Reasoning Agent
    - LLM (llama-3.3-70b via Groq) synthesizes answer
    - Grounded strictly in retrieved context
    - Structured response with headings and code blocks
    |
    v
Citation Agent
    - Filters noise from source list
    - Formats clean file path references
    |
    v
Follow-up Agent
    - Generates 3 contextual follow-up questions
    - Returns as JSON array
    |
    v
Response to Frontend
```

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Python 3.12 | Core language |
| FastAPI | REST API server |
| LangGraph | Multi-agent orchestration |
| LangChain | LLM framework |
| Groq API (llama-3.3-70b) | LLM inference |
| ChromaDB | Vector store |
| SentenceTransformers (all-MiniLM-L6-v2) | Text embeddings |
| GitPython | Repository cloning |

### Frontend
| Technology | Purpose |
|---|---|
| React + TypeScript | UI framework |
| ReactMarkdown | Markdown rendering |
| react-syntax-highlighter | Code syntax highlighting |
| Axios | HTTP client |
| localStorage | Chat history persistence |

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- Groq API key (free at console.groq.com)

### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn langchain langchain-community langgraph langchain-groq gitpython chromadb sentence-transformers python-dotenv
echo "GROQ_API_KEY=your_groq_api_key_here" > .env
uvicorn main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

The app will be available at `http://localhost:3000`

---

## Usage

1. Paste any public GitHub repository URL into the sidebar
2. Click **Index repo** and wait for the indexing pipeline to complete
3. Ask any question about the codebase in plain English
4. Click follow-up suggestions for deeper exploration
5. Use the **file filter** to scope questions to a specific file
6. Switch between multiple indexed repos from the sidebar

---

## Project Structure

```
repochat/
├── backend/
│   ├── main.py          # FastAPI server, REST endpoints
│   ├── agent.py         # LangGraph multi-agent pipeline
│   ├── indexer.py       # Repo cloning, chunking, vector storage
│   └── .env             # GROQ_API_KEY (not committed)
├── frontend/
│   ├── src/
│   │   ├── App.tsx      # Main React component
│   │   └── App.css      # Global styles
│   └── public/
│       └── index.html   # HTML entry point
└── README.md
```

---

## Key Design Decisions

**Why LangGraph over LangChain agents?**
LangGraph provides explicit state management and deterministic control flow between agents. Each agent has a clearly defined input/output contract, making the pipeline easier to debug and extend.

**Why ChromaDB over pgvector?**
ChromaDB requires zero infrastructure setup for local development, enabling faster iteration. The architecture supports swapping to pgvector for production deployments.

**Why Groq?**
Groq's LPU inference delivers sub-second response times on llama-3.3-70b, making the conversational experience feel responsive and natural.

**Why SentenceTransformers over OpenAI embeddings?**
Local embedding generation with all-MiniLM-L6-v2 eliminates API costs for the indexing pipeline and enables fully offline operation once a repo is indexed.

---

## Limitations

- Currently supports public GitHub repositories only
- Large repositories (10,000+ files) may take several minutes to index
- Answers are grounded in indexed chunks, very recent commits may not be reflected

---

## Future Improvements

- Private repository support via GitHub OAuth
- Streaming SSE responses from backend
- pgvector integration for production deployments
- Repository re-indexing on new commits via webhooks
- Multi-file diff analysis for PR review assistance

---

## Author

**Anaya Choudhari**
