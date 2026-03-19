"""
FastAPI Backend for the CSRD NG911 AI Assistant.
Provides a Server-Sent Events (SSE) endpoint to stream LangGraph agent responses
directly to the Web App frontend.
"""

import json
import logging
import threading
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import uvicorn

# Import the pre-built, tool-equipped LangGraph agent
from langchain_core.messages import HumanMessage, SystemMessage
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

class UserContext(BaseModel):
    username: str = "anonymous"
    is_admin: bool = False
    municipality: str = ""
    current_page: str = ""

class ChatRequest(BaseModel):
    message: str
    thread_id: str = "default_session"
    user_context: UserContext = UserContext()


def _build_user_context_message(ctx: UserContext) -> str:
    """Build a concise user context string for the system prompt."""
    role = "Admin" if ctx.is_admin else "Municipal Editor"
    if ctx.municipality:
        role += f" ({ctx.municipality.title()})"
    parts = [
        f"User: {ctx.username}",
        f"Role: {role}",
    ]
    if ctx.current_page:
        parts.append(f"Viewing: #{ctx.current_page}")
    return " | ".join(parts)


async def stream_agent_events(user_message: str, thread_id: str, user_context: UserContext):
    """
    Generator that invokes the LangGraph agent and yields SSE events.
    Events are formattted as dicts matching the SSE spec.
    """
    config = {"configurable": {"thread_id": thread_id}}
    
    try:
        # Build message list: inject user context as a system message, then the user query.
        messages = []
        if user_context.username != "anonymous":
            ctx_str = _build_user_context_message(user_context)
            messages.append(SystemMessage(content=f"[CURRENT USER] {ctx_str}"))
        messages.append(HumanMessage(content=user_message))

        for event, metadata in agent.stream(
            {"messages": messages},
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
            if getattr(event, "content", None) and getattr(event, "type", "") in ("ai", "AIMessageChunk"):
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
    return EventSourceResponse(
        stream_agent_events(request.message, request.thread_id, request.user_context)
    )


@app.post("/api/reingest")
async def reingest_endpoint():
    """Triggers knowledge base re-ingestion. Called by CI/CD after deploy."""
    try:
        from database.ingest import ingest
        thread = threading.Thread(target=ingest, daemon=True)
        thread.start()
        return {"status": "ingestion_started"}
    except Exception as e:
        logger.error(f"Reingest failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
