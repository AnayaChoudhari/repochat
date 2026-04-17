import os
import tempfile
from git import Repo
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import SentenceTransformerEmbeddings

CHROMA_DIR = "./chroma_db"

ALLOWED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go",
    ".cpp", ".c", ".h", ".md", ".txt", ".json", ".yaml", ".yml"
}


def get_repo_id(repo_url: str) -> str:
    return repo_url.replace("https://github.com/", "").replace("/", "_")


def index_repo(repo_url: str) -> int:
    repo_id = get_repo_id(repo_url)
    collection_path = f"{CHROMA_DIR}/{repo_id}"

    if os.path.exists(collection_path):
        print(f"Repo already indexed: {repo_id}")
        return -1

    with tempfile.TemporaryDirectory() as tmpdir:
        print(f"Cloning {repo_url}...")
        Repo.clone_from(repo_url, tmpdir, depth=1)

        docs = []
        for root, _, files in os.walk(tmpdir):
            for file in files:
                ext = os.path.splitext(file)[1]
                if ext not in ALLOWED_EXTENSIONS:
                    continue
                filepath = os.path.join(root, file)
                relative_path = filepath.replace(tmpdir, "")
                try:
                    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    if len(content.strip()) == 0:
                        continue
                    docs.append({
                        "content": content,
                        "source": relative_path
                    })
                except Exception:
                    continue

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100
        )

        chunks = []
        metadatas = []
        for doc in docs:
            splits = splitter.split_text(doc["content"])
            for split in splits:
                chunks.append(split)
                metadatas.append({"source": doc["source"]})

        print(f"Indexing {len(chunks)} chunks...")
        embeddings = SentenceTransformerEmbeddings(
            model_name="all-MiniLM-L6-v2")
        Chroma.from_texts(
            texts=chunks,
            embedding=embeddings,
            metadatas=metadatas,
            persist_directory=collection_path
        )

        return len(chunks)


def get_retriever(repo_url: str):
    repo_id = get_repo_id(repo_url)
    collection_path = f"{CHROMA_DIR}/{repo_id}"
    embeddings = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
    vectorstore = Chroma(
        persist_directory=collection_path,
        embedding_function=embeddings
    )
    return vectorstore.as_retriever(search_kwargs={"k": 8})
