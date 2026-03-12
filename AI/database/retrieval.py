"""
NG911 Knowledge Base Retrieval — utility module.
The primary search tool is in tools/knowledge_tools.py.
This module provides the raw retriever for advanced use cases.
"""

import os
from langchain_chroma import Chroma
from core.llm_config import get_embeddings

CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "./database/chroma_db")


def get_retriever(k: int = 6, category: str = ""):
    """
    Returns a configured ChromaDB retriever.
    - k: number of results.
    - category: optional metadata filter (attribute_rule, automation_script, etc.).
    """
    if not os.path.exists(CHROMA_DB_DIR):
        print("[Warning] ChromaDB directory not found. Run ingest.py first.")
        return None

    store = Chroma(
        persist_directory=CHROMA_DB_DIR,
        embedding_function=get_embeddings(),
    )

    search_kwargs = {"k": k}
    if category:
        search_kwargs["filter"] = {"category": category}

    return store.as_retriever(
        search_type="similarity",
        search_kwargs=search_kwargs,
    )
