from typing import Annotated, Literal
import json
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from core.llm_config import get_llm
from pydantic import BaseModel, Field

# Define the state of the graph
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], "add"]
    next_agent: str

# Initialize the LLM in JSON mode
llm = get_llm(fmt="json")

from langchain_core.runnables.config import RunnableConfig

# Define the Supervisor's prompt and routing logic
def supervisor_node(state: AgentState, config: RunnableConfig):
    """
    Analyzes the user's request and routes to the appropriate specialized sub-agent.
    """
    messages = state["messages"]
    
    system_prompt = SystemMessage(content="""
    You are the NG911 Supervisor Agent. Your job is to route the user's request to the correct specialized agent.
    
    Choose ONE of the following:
    - database_agent: For questions about the NG911 database schema, domains, and feature class structure.
    - qa_agent: For questions about GIS errors, validation rules, or troubleshooting specific QA flags.
    - scripting_agent: For help with Python, ArcPy, or .pyt automation scripts.
    - attribute_rule_agent: For help writing or debugging Arcade attribute rules.
    - file_inquiries_agent: For finding GIS server rest endpoints, internal system URLs, or network paths.
    - general_agent: If the user is just saying hello, saying thank you, or their request is out of bounds.
    
    You must respond in raw JSON format with exactly one key: {"next_agent": "agent_name"}
    """)
    
    # We pass the system prompt + ONLY the most recent message to the LLM to decide the next step
    # This prevents the supervisor from getting confused by old conversation history (e.g., a previous "Hi")
    last_message = messages[-1]
    instruction = [system_prompt, last_message]
    
    try:
        import time
        start_time = time.time()
        print("[Supervisor] Sending prompt to Qwen27B...")
        response = llm.invoke(instruction, config=config)
        print(f"[Supervisor] Qwen27B inference took {time.time() - start_time:.2f} seconds.")
        # Parse the JSON back manually, handling potential markdown formatting
        import re
        content = response.content.strip()
        match = re.search(r'```(?:json)?(.*?)```', content, re.DOTALL)
        if match:
            content = match.group(1).strip()
            
        decision = json.loads(content)
        next_agent = decision.get("next_agent", "general_agent")
    except Exception as e:
        # Fallback if structure fails
        print(f"[Supervisor Error] Failed to parse JSON: '{response.content}' | Error: {e}")
        next_agent = "general_agent"
        
    return {"next_agent": next_agent}

from agents.database_agent import database_agent
from agents.qa_agent import qa_agent
from agents.scripting_agent import scripting_agent
from agents.attribute_agent import attribute_rule_agent
from agents.file_agent import file_inquiries_agent
from agents.general_agent import general_agent

# Create the graph
workflow = StateGraph(AgentState)

# Add the supervisor node
workflow.add_node("supervisor", supervisor_node)

# Add sub-agent nodes
workflow.add_node("database_agent", database_agent)
workflow.add_node("qa_agent", qa_agent)
workflow.add_node("scripting_agent", scripting_agent)
workflow.add_node("attribute_rule_agent", attribute_rule_agent)
workflow.add_node("file_inquiries_agent", file_inquiries_agent)
workflow.add_node("general_agent", general_agent)

# Add conditional routing from supervisor
workflow.add_conditional_edges(
    "supervisor",
    lambda state: state["next_agent"],
    {
        "database_agent": "database_agent",
        "qa_agent": "qa_agent",
        "scripting_agent": "scripting_agent",
        "attribute_rule_agent": "attribute_rule_agent",
        "file_inquiries_agent": "file_inquiries_agent",
        "general_agent": "general_agent",
        "FINISH": END
    }
)

# Add edges back from sub-agents to FINISH (end of flow)
for agent in ["database_agent", "qa_agent", "scripting_agent", "attribute_rule_agent", "file_inquiries_agent", "general_agent"]:
    workflow.add_edge(agent, END)

# Set the entry point
workflow.set_entry_point("supervisor")

# Compile the graph
app = workflow.compile()
