import json
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from core.llm_config import get_llm
from database.retrieval import search_knowledge_base

# Initialize LLM
llm = get_llm()

@tool
def lookup_arcade_rule(query: str) -> str:
    """
    Searches the ingested database for Arcade attribute rules (`.js`, `.txt`)
    associated with the NG911 feature classes context.
    """
    # Search for arcade logic
    return search_knowledge_base(query)

# Define the tools available to this agent
arcade_tools = [lookup_arcade_rule]

# Define the System Prompt
arcade_system_prompt = """
You are the NG911 Arcade Attribute Rule Agent.
Your role is to help write, optimize, or troubleshoot Arcade expressions for ArcGIS Pro
Attribute Rules. 
Use your `lookup_arcade_rule` tool to see how existing rules calculate values, loop through related records,
or build error validation logic before you suggest a new rule.
Explain the purpose of the array variables ($feature, $datastore) and the expected return types if generating new rules.
Ensure your answers are professional, elegant, concise, and formatted with clean markdown (e.g., tables, bold headers, and bullet points) for maximum readability.
"""

# Create the LangGraph Agent node
attribute_rule_agent = create_react_agent(
    llm,
    tools=arcade_tools,
    prompt=arcade_system_prompt
)
