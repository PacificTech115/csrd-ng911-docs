"""
NG911 Knowledge Base Ingestion Pipeline.
Chunks and ingests project source files into ChromaDB with enriched metadata.

Dynamic architecture:
- Scans ALL web app files including HTML partials (32+ pages)
- Ingests full documentation directory (schema, dependencies, guides)
- Rebuilds the navigation map after ingestion
- Called automatically via /api/reingest endpoint
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
        meta["component"] = base
    elif "1.reconcilepost" in fp or "reconcile" in fp:
        meta["category"] = "automation_script"
        meta["component"] = os.path.basename(file_path)
    elif "2. salmon arm" in fp or "salmonarm" in fp:
        meta["category"] = "automation_script"
        meta["component"] = "SalmonArm_ETL"
    elif "documentation" in fp:
        meta["category"] = "documentation"
        meta["component"] = os.path.basename(file_path)
    elif "partials" in fp:
        # HTML page partials — tag with page route for precise retrieval
        base = os.path.splitext(os.path.basename(file_path))[0]
        meta["category"] = "web_page"
        meta["component"] = base  # e.g., "schema-guide", "rule-nguid"
    elif "web app" in fp:
        meta["category"] = "web_app"
        meta["component"] = os.path.basename(file_path)
    return meta


def load_documents(directory: str, extensions: list[str]) -> list:
    """Recursively load files from a directory, skipping non-essential folders."""
    documents = []
    # Only skip truly non-useful directories — partials are NOW included
    skip_dirs = {"Archive", "venv", "__pycache__", "node_modules", ".git", "chroma_db", "assets"}

    for ext in extensions:
        pattern = os.path.join(directory, f"**/*.{ext}")
        for file_path in glob.glob(pattern, recursive=True):
            # Skip directories we don't want
            parts = set(file_path.replace("\\", "/").split("/"))
            if parts & skip_dirs:
                continue

            # Skip massive files (binary/generated data)
            try:
                size = os.path.getsize(file_path)
                if size > 120_000:  # 120KB limit (increased for large HTML partials)
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

    # Define sources — read directly from the repo root.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.normpath(os.path.join(script_dir, "..", ".."))

    sources = {
        # NG911 System: Attribute Rules
        os.path.join(repo_root, "NG911System", "Database Scripts", "0.Attribute Rules"): ["txt", "js"],
        # NG911 System: Automation scripts + Power Automate templates
        os.path.join(repo_root, "NG911System", "Database Scripts", "1.ReconcilePost-QA-Export"): ["py", "html"],
        os.path.join(repo_root, "NG911System", "Database Scripts", "2. Salmon Arm Sync"): ["py", "html"],
        # Documentation: Schema summary, system dependencies, guides
        os.path.join(repo_root, "Context", "Documentation"): ["md", "txt"],
        # Web App: JS modules, CSS, AND HTML partials (all 32+ pages)
        os.path.join(repo_root, "Web App", "docs"): ["js", "css", "html"],
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
            "\n<section",  # HTML section boundaries
            "\n<div",      # HTML div boundaries
            "\n<tr",       # HTML table row boundaries
            "\n\n",        # Paragraph breaks
            "\n",          # Line breaks
            " ",           # Word breaks
        ],
    )
    chunks = splitter.split_documents(all_docs)
    print(f"Created {len(chunks)} chunks (avg ~{sum(len(c.page_content) for c in chunks)//max(len(chunks),1)} chars).")

    print("\n--- Ingesting into ChromaDB ---")
    BATCH = 100
    for i in range(0, len(chunks), BATCH):
        batch = chunks[i : i + BATCH]
        store.add_documents(batch)
        print(f"  Batch {i // BATCH + 1}: {len(batch)} chunks embedded.")

    print(f"\n[Done] {len(chunks)} chunks stored in {CHROMA_DB_DIR}")

    # Rebuild the navigation map after ingestion so it picks up any new pages/fields
    try:
        from tools.navigation_tools import build_navigation_map
        nav = build_navigation_map()
        print(f"[Nav] Navigation map rebuilt: {len(nav)} entries")
    except Exception as e:
        print(f"[Nav] Warning: could not rebuild navigation map: {e}")


if __name__ == "__main__":
    ingest()
