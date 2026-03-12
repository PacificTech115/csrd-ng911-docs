from core.llm_config import get_llm

def test_connection():
    try:
        print("\\n[System] Connecting to Ollama...")
        llm = get_llm()
        
        # Simple test prompt
        response = llm.invoke("Say 'Connection Successful' if you are receiving this.")
        
        print("\\n[Response]:", response.content)
        print("[System] Environment connects successfully!")
    except Exception as e:
        print("\\n[Error] Failed to connect to Ollama. Ensure the Ollama service is running.")
        print(f"Details: {e}")

if __name__ == "__main__":
    test_connection()
