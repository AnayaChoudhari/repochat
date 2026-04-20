import os
import json
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from indexer import get_retriever
from typing import TypedDict, List

load_dotenv()

llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model_name="llama-3.3-70b-versatile"
)


class AgentState(TypedDict):
    question: str
    repo_url: str
    retrieved_chunks: List[str]
    sources: List[str]
    answer: str
    followups: List[str]


def retrieval_agent(state: AgentState) -> AgentState:
    print(">> Retrieval agent running...")
    question = state["question"]
    if "Specifically about file" in question:
        filename = question.split("Specifically about file")[
            1].split(":")[0].strip()
        retriever = get_retriever(state["repo_url"], k=20)
        docs = retriever.invoke(question)
        filtered = [d for d in docs if filename.lower(
        ) in d.metadata.get("source", "").lower()]
        docs = filtered if filtered else docs
    else:
        retriever = get_retriever(state["repo_url"])
        docs = retriever.invoke(question)
    print(f">> Found {len(docs)} docs, sources: {
          [d.metadata.get('source', '') for d in docs]}")
    state["retrieved_chunks"] = [doc.page_content for doc in docs]
    state["sources"] = list(
        set([doc.metadata.get("source", "") for doc in docs]))
    return state


def reasoning_agent(state: AgentState) -> AgentState:
    print(">> Reasoning agent running...")
    context = "\n\n---\n\n".join(state["retrieved_chunks"])
    messages = [
        SystemMessage(content="""You are an expert software engineer helping a developer
understand a codebase. Answer questions clearly using only the provided code context.

Rules:
- Always cite SPECIFIC file paths like /lib/router.js or /src/index.py
- NEVER create markdown links like [text](url) — only plain file paths
- NEVER use relative links or anchor links like #section-name
- If showing code, use proper markdown code blocks with language
- Be direct and specific — no "probably" or "it seems"
- Keep answers concise with bullet points for key details
- Only answer if the context is clearly relevant to the question
- If the context doesn't contain relevant info, say exactly: "I couldn't find relevant information for this query. Try asking something more specific."
"""),
        HumanMessage(content=f"""
Context from codebase:
{context}

Question: {state["question"]}

Answer with specific file references where relevant.
""")
    ]
    response = llm.invoke(messages)
    state["answer"] = response.content
    return state


def citation_agent(state: AgentState) -> AgentState:
    print(">> Citation agent running...")

    no_info_phrases = [
        "couldn't find relevant information",
        "not enough detail",
        "insufficient context",
        "no relevant information"
    ]

    answer_lower = state["answer"].lower()
    if any(phrase in answer_lower for phrase in no_info_phrases):
        return state

    IGNORE_PATTERNS = [
        'test/fixtures', 'node_modules',
        'History.md', 'LICENSE', 'CHANGELOG', '.gitignore'
    ]

    filtered_sources = [
        s for s in state["sources"]
        if not any(pattern.lower() in s.lower() for pattern in IGNORE_PATTERNS)
    ]

    if not filtered_sources:
        filtered_sources = state["sources"][:5]

    sources_formatted = "\n".join([f"- `{s}`" for s in filtered_sources])
    state["answer"] = f"{state['answer']
                         }\n\n---\n\n📁 **Sources:**\n{sources_formatted}"
    return state


def followup_agent(state: AgentState) -> AgentState:
    print(">> Follow-up agent running...")
    messages = [
        SystemMessage(content="""You are a helpful assistant. Given a question and answer about a codebase,
generate exactly 3 short follow-up questions a developer might ask next.
Return ONLY a JSON array of 3 strings. No preamble, no markdown, just the array.
Example: ["How is X tested?", "Where is Y configured?", "What happens when Z fails?"]"""),
        HumanMessage(content=f"""
Question asked: {state["question"]}
Answer given: {state["answer"][:500]}

Generate 3 follow-up questions.
""")
    ]
    try:
        response = llm.invoke(messages)
        questions = json.loads(response.content.strip())
        state["followups"] = questions[:3]
    except:
        state["followups"] = []
    return state


def build_graph():
    graph = StateGraph(AgentState)
    graph.add_node("retrieval", retrieval_agent)
    graph.add_node("reasoning", reasoning_agent)
    graph.add_node("citation", citation_agent)
    graph.add_node("followup", followup_agent)
    graph.set_entry_point("retrieval")
    graph.add_edge("retrieval", "reasoning")
    graph.add_edge("reasoning", "citation")
    graph.add_edge("citation", "followup")
    graph.add_edge("followup", END)
    return graph.compile()


agent_graph = build_graph()


def run_agent(question: str, repo_url: str) -> dict:
    result = agent_graph.invoke({
        "question": question,
        "repo_url": repo_url,
        "retrieved_chunks": [],
        "sources": [],
        "answer": "",
        "followups": []
    })
    return {"answer": result["answer"], "followups": result["followups"]}
