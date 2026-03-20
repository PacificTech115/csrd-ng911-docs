"""
Improved knowledge-base search tool backed by ChromaDB.
"""

import os
from langchain_chroma import Chroma
from langchain_core.tools import tool
from core.llm_config import get_embeddings

CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "./database/chroma_db")


def _get_vector_store():
    if not os.path.exists(CHROMA_DB_DIR):
        return None
    return Chroma(
        persist_directory=CHROMA_DB_DIR,
        embedding_function=get_embeddings(),
    )


@tool
def search_knowledge_base(query: str, category: str = "") -> str:
    """Search the NG911 vector knowledge base for documentation, scripts, and rules.
    Use this for broad or ambiguous questions where you don't know which specific file to read.
    - query:    natural-language search query.
    - category: optional filter — one of: attribute_rule, automation_script, documentation, web_app.
                Leave empty to search everything.
    Returns the top 6 most relevant chunks with source paths.
    """
    store = _get_vector_store()
    if store is None:
        return "Error: Knowledge base not initialized. Run ingest.py first."

    search_kwargs = {"k": 4}
    if category:
        search_kwargs["filter"] = {"category": category}

    docs = store.similarity_search(query, **search_kwargs)

    if not docs:
        return "No relevant information found in the knowledge base."

    results = []
    for i, doc in enumerate(docs, 1):
        src = doc.metadata.get("source", "Unknown")
        comp = doc.metadata.get("component", "")
        tag = f" [{comp}]" if comp else ""
        results.append(
            f"--- Result {i} (Source: {src}{tag}) ---\n{doc.page_content}"
        )
    return "\n\n".join(results)
