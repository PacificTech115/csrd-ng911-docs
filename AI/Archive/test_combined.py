from core.llm_config import get_llm, get_embeddings
import time

def test_interaction():
    print("[1] Initializing both connections...")
    llm = get_llm()
    emb = get_embeddings()
    
    # 1. Ask the LLM something to force 27B into VRAM (27GB)
    print("\\n[2] Waking up qwen3.5:27b...")
    start_time = time.time()
    resp = llm.invoke("Just reply 'Awake'")
    print(f" -> Response: {resp.content} (Took {time.time() - start_time:.2f}s)")
    
    # 2. Ask the Embedder something to force 4B into VRAM (12GB)
    # This might cause a deadlock or huge delay if VRAM is exceeded
    print("\\n[3] Waking up qwen3-embedding:4b (Testing Thrashing)...")
    start_time = time.time()
    vector = emb.embed_query("Testing memory swap")
    print(f" -> Embedded length: {len(vector)} (Took {time.time() - start_time:.2f}s)")
    
    # 3. Quickly switch back to LLM
    print("\\n[4] Switching back to qwen3.5:27b...")
    start_time = time.time()
    resp = llm.invoke("Just reply 'Returned'")
    print(f" -> Response: {resp.content} (Took {time.time() - start_time:.2f}s)")
    
    print("\\n[5] Test Completed Successfully!")

if __name__ == "__main__":
    test_interaction()
