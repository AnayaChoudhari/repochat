from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agent import run_agent
from indexer import index_repo

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RepoRequest(BaseModel):
    repo_url: str


class ChatRequest(BaseModel):
    question: str
    repo_url: str


@app.post("/index")
async def index(req: RepoRequest):
    result = index_repo(req.repo_url)
    return {"status": "indexed", "files": result}


@app.post("/chat")
async def chat(req: ChatRequest):
    if len(req.question.strip()) < 5:
        return {
            "answer": "❓ Please ask a proper question about the codebase.",
            "followups": [
                "How does routing work?",
                "Where is the main entry point?",
                "How does authentication work?"
            ]
        }
    result = run_agent(req.question, req.repo_url)
    return {"answer": result["answer"], "followups": result["followups"]}


@app.get("/")
def root():
    return {"status": "RepoChat backend running"}
