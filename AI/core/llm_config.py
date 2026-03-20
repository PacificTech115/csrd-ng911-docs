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
    - num_ctx=32768:   32K context cap. Fits comfortably in RTX 5090 VRAM
                       alongside the ~26GB model weights.
    - num_predict=2048: Prevents runaway generation on verbose answers.
    - num_batch=512:   Parallel prompt evaluation tokens for faster prefill.
    - num_gpu=99:      Force all model layers onto GPU (no CPU offloading).
    """
    return ChatOllama(
        base_url=OLLAMA_BASE_URL,
        model=MAIN_MODEL,
        temperature=temperature,
        num_ctx=32768,
        num_predict=2048,
        num_batch=512,
        num_gpu=99,
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
