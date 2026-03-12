from core.llm_config import get_embeddings
import time

print("[1] Loading OllamaEmbeddings...")
emb = get_embeddings()

print("[2] Requesting 1 embedding to test Ollama connection...")
start_time = time.time()
try:
    vector = emb.embed_query("Hello world")
    end_time = time.time()
    print(f"[3] Success! Vector length: {len(vector)}")
    print(f"Time taken to get embedding: {end_time - start_time:.2f} seconds")
except Exception as e:
    print(f"[Error] Embedding failed: {e}")
