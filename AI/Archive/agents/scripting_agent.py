import json
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from core.llm_config import get_llm
from database.retrieval import search_knowledge_base

# Initialize LLM
llm = get_llm()

@tool
def investigate_arcpy_scripts(query: str) -> str:
    """
    Searches the ingested Python scripts (`.py`, `.pyt`) for automation logic,
    pipeline orchestrators, and tool parameters.
    """
    # Filter to only search Python files in the database
    return search_knowledge_base(query, filter_ext="py")

# Define the tools available to this agent
scripting_tools = [investigate_arcpy_scripts]

# Define the System Prompt
scripting_system_prompt = """
You are the NG911 Python Automation Scripting Agent.
Your role is to help the user write, debug, and optimize ArcPy scripts, Python Toolboxes (.pyt),
and orchestration pipelines for the NG911 system.
Use your `investigate_arcpy_scripts` tool to read the existing logic before proposing changes,
ensuring whatever you write matches the current architecture patterns.
When providing code snippets, include brief comments explaining the logic.
Ensure your answers are professional, elegant, concise, and formatted with clean markdown (e.g., tables, bold headers, and bullet points) for maximum readability.
"""

# Create the LangGraph Agent node
scripting_agent = create_react_agent(
    llm,
    tools=scripting_tools,
    prompt=scripting_system_prompt
)
