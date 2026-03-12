from langchain_chroma import Chroma
from core.llm_config import get_embeddings
import os

persist_directory = os.path.join(os.path.dirname(__file__), "database", "chroma_db")
embeddings = get_embeddings()
vectorstore = Chroma(persist_directory=persist_directory, embedding_function=embeddings)

query = "How many fields are in the database?"
results = vectorstore.similarity_search(query, k=5)

with open('test_results.txt', 'w', encoding='utf-8') as f:
    for i, res in enumerate(results):
        f.write(f"--- Result {i+1} (Source: {res.metadata.get('source', 'Unknown')}) ---\\n")
        f.write(res.page_content[:200] + "\\n\\n")
