import os
from dotenv import load_dotenv
from langchain_ollama import ChatOllama
from langchain_ollama.embeddings import OllamaEmbeddings

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
MAIN_MODEL = os.getenv("MAIN_MODEL", "qwen3.5:35b")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text")


def get_llm(temperature=0.0):
    """
    Returns the primary ChatOllama LLM instance optimized for the RTX 5090.
    - num_ctx=65536:   64K context cap. Actual usage is kept lower by the
                       trim_messages state_modifier in agent.py.
                       May approach VRAM limits -- drop to 32768 if generation slows.
    - num_predict=3072: Prevents runaway generation on verbose answers.
    """
    return ChatOllama(
        base_url=OLLAMA_BASE_URL,
        model=MAIN_MODEL,
        temperature=temperature,
        num_ctx=65536,
        num_predict=3072,
    )


def get_embeddings():
    """
    Returns the Ollama Embeddings instance for ChromaDB.
    Uses nomic-embed-text (768-dim, fast, proven for code + docs).
    """
    return OllamaEmbeddings(
        base_url=OLLAMA_BASE_URL,
        model=EMBEDDING_MODEL,
    )
