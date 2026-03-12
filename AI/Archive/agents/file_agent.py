import json
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from core.llm_config import get_llm
from database.retrieval import search_knowledge_base

# Initialize LLM
llm = get_llm()

@tool
def search_system_urls(query: str) -> str:
    """
    Searches the ingested documentation and configuration files for internal GIS Server URLs, 
    REST endpoints, or network paths.
    """
    return search_knowledge_base(query)

# Define the tools available to this agent
url_tools = [search_system_urls]

# Define the System Prompt
url_system_prompt = """
You are the NG911 File and Server Inquiries Agent.
Your role is to help users find ArcGIS REST endpoints, internal URLs, network paths, and server configuration details.
Use your `search_system_urls` tool to lookup the exact string paths and URLs documented in the system.
If a user asks where Always use `query_ng911_links_knowledge` to search the documentation for URLs and server details.
Ensure your answers are professional, elegant, concise, and formatted with clean markdown (e.g., tables, bold headers, and bullet points) for maximum readability.
"""

# Create the LangGraph Agent node
file_inquiries_agent = create_react_agent(
    llm,
    tools=url_tools,
    prompt=url_system_prompt
)
