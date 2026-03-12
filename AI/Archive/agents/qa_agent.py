import json
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from core.llm_config import get_llm
from database.retrieval import search_knowledge_base

# Initialize LLM
llm = get_llm()

@tool
def troubleshoot_qa_error(query: str) -> str:
    """
    Searches the ingested documentation and scripts specifically for QA error codes, 
    validation logic, and troubleshooting steps.
    """
    # In a full production build, we might restrict this filter_ext="py" or "md"
    # to only search the automated testing and diagnostic scripts.
    return search_knowledge_base(query)

# Define the tools available to this agent
qa_tools = [troubleshoot_qa_error]

# Define the System Prompt
qa_system_prompt = """
You are the NG911 QA and Error Diagnostics Agent.
Your role is to help users resolve GIS topological errors, validation failures, and QA logic flags.
Use your `troubleshoot_qa_error` tool to find how the system expects the data to be formatted,
or to find the specific script that flags the error they are seeing.
Provide actionable, step-by-step solutions to fix the data based on the documentation.
"""

# Create the LangGraph Agent node
qa_agent = create_react_agent(
    llm,
    tools=qa_tools,
    prompt=qa_system_prompt
)
