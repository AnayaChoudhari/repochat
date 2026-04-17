# RepoChat - Agentic RAG Codebase Onboarding Agent

Chat with any GitHub repository using AI. Ask questions about any codebase and get cited answers with exact file references.

## Demo
![RepoChat Demo](demo.png)

## Features
- Multi-agent pipeline: Retrieval, Reasoning, Citation, and Follow-up agents
- Semantic search using ChromaDB vector store
- Syntax highlighted code answers
- Chat history per repo
- File-specific filtering
- Follow-up question suggestions
- Multi-repo support

## Tech Stack
**Backend:** Python, FastAPI, LangGraph, LangChain, Groq (llama-3.3-70b), ChromaDB, SentenceTransformers

**Frontend:** React, TypeScript, ReactMarkdown, react-syntax-highlighter

## Setup

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
echo "GROQ_API_KEY=your_key_here" > .env
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## Architecture
The app uses a 4-agent LangGraph pipeline:
1. **Retrieval Agent** - Semantic search over indexed codebase chunks
2. **Reasoning Agent** - LLM synthesizes answer from retrieved context
3. **Citation Agent** - Filters and formats source file references
4. **Follow-up Agent** - Generates 3 contextual follow-up questions
