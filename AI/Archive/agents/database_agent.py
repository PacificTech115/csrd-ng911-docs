import json
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from core.llm_config import get_llm
from database.retrieval import search_knowledge_base

# Initialize LLM
llm = get_llm()

@tool
def query_ng911_database_knowledge(query: str) -> str:
    """
    Searches the ingested vector database specifically for NG911 schema, domains, and database tables.
    Use this when asked about feature class structures, field names, or domain mappings.
    """
    # We can filter to only search documentation files (.md, .txt) if desired
    # For now we search the whole database
    return search_knowledge_base(query)

import os

@tool
def read_full_database_schema() -> str:
    """
    Reads the complete Database Schema Summary document.
    Use this tool when explicitly asked to count the exact number of fields, or 
    to list all fields in the database schema without relying on semantic chunk search.
    """
    file_path = r"C:\Users\solim\Arcgis Notebooks\Documentation\Database_Schema_Summary.md"
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    return "Error: Could not locate the central database schema file."

# Define the tools available to this specific agent
database_tools = [query_ng911_database_knowledge, read_full_database_schema]

# Define the System Prompt
database_system_prompt = """
You are the NG911 Database Schema Expert Agent. 
Your role is to answer questions about the NG911 database structure, attribute schemas, and domains.
Always use your `query_ng911_database_knowledge` tool to search for specific field names and domains before answering.
CRITICAL: If the user asks for the TOTAL NUMBER of fields, or an EXACT COUNT of schema fields, you MUST use the `read_full_database_schema` tool to read the complete document instead of guessing.
If the information is not in the knowledge base or the schema document, state that clearly instead of guessing.
Ensure your answers are professional, elegant, concise, and formatted with clean markdown (e.g., tables, bold headers, and bullet points) for maximum readability.
"""

# Create the LangGraph Agent node
database_agent = create_react_agent(
    llm,
    tools=database_tools,
    prompt=database_system_prompt
)
