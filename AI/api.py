"""
FastAPI Backend for the CSRD NG911 AI Assistant.
Provides a Server-Sent Events (SSE) endpoint to stream LangGraph agent responses
directly to the Web App frontend.
"""

import json
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import uvicorn
import requests

# Import the pre-built, tool-equipped LangGraph agent
from langchain_core.messages import HumanMessage
from agent import agent

# Set up logging to avoid polluting stdout
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="CSRD NG911 AI Assistant API")

# Configure CORS so the Web App (which may run on a different port/IP) can communicate
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production to restrict to the Portal's domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default_session"

async def stream_agent_events(user_message: str, thread_id: str):
    """
    Generator that invokes the LangGraph agent and yields SSE events.
    Events are formattted as dicts matching the SSE spec.
    """
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        # Wrap the query in a HumanMessage.
        # Since 'ui/app.py' originally used agent.stream(..., stream_mode="messages"),
        # we do the same here to get token-by-token streaming and tool calls.
        for event, metadata in agent.stream(
            {"messages": [HumanMessage(content=user_message)]},
            config=config,
            stream_mode="messages",
        ):
            # Check if this is a tool call start
            if hasattr(event, "tool_calls") and event.tool_calls:
                for tc in event.tool_calls:
                    name = tc.get("name", "")
                    if name:
                        # Yield a special 'tool' event so the frontend can display a status ribbon
                        yield {
                            "event": "tool",
                            "data": json.dumps({"tool": name})
                        }
            
            # Check if this is an AI Message token payload
            if event.content and event.type == "ai":
                # Some events might just be tool execution acknowledgments; 
                # we only want to stream actual textual content destined for the user.
                yield {
                    "event": "message",
                    "data": json.dumps({"chunk": event.content})
                }

        # Issue completion event
        yield {
            "event": "done",
            "data": "{}"
        }

    except Exception as e:
        logger.error(f"Error during agent execution: {e}")
        yield {
            "event": "error",
            "data": json.dumps({"error": str(e)})
        }

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Accepts a user message and returns an SSE stream.
    """
    return EventSourceResponse(stream_agent_events(request.message, request.thread_id))

if __name__ == "__main__":
    # Run the server locally. Host 0.0.0.0 allows it to be accessed from the network.
    uvicorn.run(app, host="0.0.0.0", port=8000)
