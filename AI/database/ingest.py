"""
NG911 Knowledge Base Ingestion Pipeline.
Chunks and ingests project source files into ChromaDB with enriched metadata.

Key improvements over the original:
- 2500-char chunks (was 750) to keep functions/rules intact.
- Metadata enrichment with category and component tags.
- Deduplication: ingest raw source files only (skip HTML docs that embed the same code).
- Incremental-aware: wipes before ingest but architecture supports hash-based diffing later.
"""

import os
import glob
from dotenv import load_dotenv
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from core.llm_config import get_embeddings

load_dotenv()

CHROMA_DB_DIR = os.getenv("CHROMA_DB_DIR", "./database/chroma_db")


# ─── Category / component tagging rules ──────────────────────────────
def _classify(file_path: str) -> dict:
    """Derive category and component metadata from the file path."""
    fp = file_path.replace("\\", "/").lower()
    meta = {"category": "other", "component": ""}

    if "0.attribute rules" in fp:
        meta["category"] = "attribute_rule"
        base = os.path.splitext(os.path.basename(file_path))[0]
        meta["component"] = base  # e.g., "1.Full Address"
    elif "1.reconcilepost" in fp or "reconcile" in fp:
        meta["category"] = "automation_script"
        meta["component"] = os.path.basename(file_path)
    elif "2. salmon arm" in fp or "salmonarm" in fp:
        meta["category"] = "automation_script"
        meta["component"] = "SalmonArm_ETL"
    elif "documentation" in fp:
        meta["category"] = "documentation"
        meta["component"] = os.path.basename(file_path)
    elif "web app" in fp:
        meta["category"] = "web_app"
        meta["component"] = os.path.basename(file_path)
    return meta


def load_documents(directory: str, extensions: list[str]) -> list:
    """Recursively load files from a directory, skipping Archive and venv folders."""
    documents = []
    skip_dirs = {"Archive", "venv", "__pycache__", "node_modules", ".git", "chroma_db", "assets", "partials"}

    for ext in extensions:
        pattern = os.path.join(directory, f"**/*.{ext}")
        for file_path in glob.glob(pattern, recursive=True):
            # Skip directories we don't want
            parts = set(file_path.replace("\\", "/").split("/"))
            if parts & skip_dirs:
                continue

            # Skip massive files that add noise (Base64 blobs, search indexes)
            try:
                size = os.path.getsize(file_path)
                if size > 80_000:  # > 80KB is likely a generated/data file
                    print(f"[Skip large] {file_path} ({size:,} bytes)")
                    continue
            except OSError:
                continue

            try:
                loader = TextLoader(file_path, encoding="utf-8")
                loaded = loader.load()
                meta = _classify(file_path)
                for doc in loaded:
                    doc.metadata["source"] = file_path
                    doc.metadata["extension"] = ext
                    doc.metadata.update(meta)
                documents.extend(loaded)
                print(f"[Loaded] {file_path}")
            except Exception as e:
                print(f"[Skip error] {file_path}: {e}")
    return documents


def ingest():
    """Run the full ingestion pipeline."""
    embeddings = get_embeddings()
    store = Chroma(persist_directory=CHROMA_DB_DIR, embedding_function=embeddings)

    # Wipe existing data
    print("\n--- Clearing existing ChromaDB ---")
    try:
        existing = store.get()
        if existing and existing.get("ids"):
            store.delete(ids=existing["ids"])
            print(f"Deleted {len(existing['ids'])} existing chunks.")
    except Exception as e:
        print(f"Note: {e}")

    # Define sources — RAW source files only, no HTML duplicates
    # Resolve data dir relative to this script's location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "..", "data")

    sources = {
        os.path.join(data_dir, "Database Scripts", "0.Attribute Rules"): ["txt", "js"],
        os.path.join(data_dir, "Database Scripts", "1.ReconcilePost-QA-Export"): ["py", "html"],
        os.path.join(data_dir, "Database Scripts", "2. Salmon Arm Sync"): ["py", "html"],
        os.path.join(data_dir, "Documentation"): ["md", "txt"],
        # Web App: only the JS modules and CSS — NOT the HTML partials
        os.path.join(data_dir, "Web App", "docs"): ["js", "css"],
    }

    all_docs = []
    print("\n--- Loading documents ---")
    for directory, extensions in sources.items():
        if os.path.exists(directory):
            docs = load_documents(directory, extensions)
            all_docs.extend(docs)
        else:
            print(f"[Warning] Not found: {directory}")

    if not all_docs:
        print("\n[Error] No documents loaded.")
        return

    print(f"\n--- Splitting {len(all_docs)} documents ---")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=2500,
        chunk_overlap=300,
        length_function=len,
        separators=[
            "\ndef ",      # Python function boundaries
            "\nclass ",    # Python class boundaries
            "\n## ",       # Markdown H2
            "\n# ",        # Markdown H1
            "\n\n",        # Paragraph breaks
            "\n",          # Line breaks
            " ",           # Word breaks
        ],
    )
    chunks = splitter.split_documents(all_docs)
    print(f"Created {len(chunks)} chunks (avg ~{sum(len(c.page_content) for c in chunks)//max(len(chunks),1)} chars).")

    print("\n--- Ingesting into ChromaDB ---")
    # Batch to avoid memory issues with large embedding sets
    BATCH = 100
    for i in range(0, len(chunks), BATCH):
        batch = chunks[i : i + BATCH]
        store.add_documents(batch)
        print(f"  Batch {i // BATCH + 1}: {len(batch)} chunks embedded.")

    print(f"\n[Done] {len(chunks)} chunks stored in {CHROMA_DB_DIR}")


if __name__ == "__main__":
    ingest()
