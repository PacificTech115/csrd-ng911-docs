"""
FastAPI Backend for the CSRD NG911 AI Assistant.
Provides a Server-Sent Events (SSE) endpoint to stream LangGraph agent responses
directly to the Web App frontend.
"""

import json
import logging
import re
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import uvicorn

# Import the pre-built, tool-equipped LangGraph agent
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from agent import create_agent, DB_PATH
from tools.navigation_tools import get_navigation_target

# Set up logging to avoid polluting stdout
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global agent reference (set during startup)
agent = None
checkpointer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage async SQLite checkpointer lifecycle."""
    global agent, checkpointer
    async with AsyncSqliteSaver.from_conn_string(DB_PATH) as checkpointer:
        agent = create_agent(checkpointer)
        logger.info(f"SQLite checkpointer initialized at {DB_PATH}")
        yield


app = FastAPI(title="CSRD NG911 AI Assistant API", lifespan=lifespan)

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

        accumulated_text = ""

        async for event, metadata in agent.astream(
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
                accumulated_text += event.content
                yield {
                    "event": "message",
                    "data": json.dumps({"chunk": event.content})
                }

        # Auto-append navigation link if the agent didn't include one
        if "{{nav:" not in accumulated_text:
            nav_result = get_navigation_target.invoke(user_message)
            if "{{nav:" in nav_result:
                nav_match = re.search(r'\{\{nav:[^}]+\}\}', nav_result)
                if nav_match:
                    nav_chunk = "\n\n" + nav_match.group(0)
                    yield {
                        "event": "message",
                        "data": json.dumps({"chunk": nav_chunk})
                    }

        # Save/update conversation metadata
        title = user_message[:50].strip()
        if len(user_message) > 50:
            title += "..."
        _upsert_conversation_meta(thread_id, user_context.username, title)

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
    """Triggers knowledge base re-ingestion + nav map rebuild. Called by CI/CD after deploy."""
    try:
        from database.ingest import ingest
        thread = threading.Thread(target=ingest, daemon=True)
        thread.start()
        return {"status": "ingestion_started", "note": "Navigation map will rebuild after ingestion completes."}
    except Exception as e:
        logger.error(f"Reingest failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/nav-map")
async def nav_map_endpoint():
    """Returns the current dynamic navigation map (for debugging)."""
    from tools.navigation_tools import NAVIGATION_MAP
    return {"count": len(NAVIGATION_MAP), "entries": NAVIGATION_MAP}


# ─── Conversation History Endpoints ──────────────────────────────────

# Separate SQLite table for conversation metadata (title, user, timestamps)
# The checkpointer stores message content; this stores the index.
import sqlite3

def _ensure_meta_table():
    """Create conversation metadata table if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS conversation_meta (
            thread_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()

_ensure_meta_table()


def _upsert_conversation_meta(thread_id: str, username: str, title: str):
    """Insert new conversation or update timestamp of existing one (title preserved)."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        INSERT INTO conversation_meta (thread_id, username, title, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(thread_id) DO UPDATE SET updated_at = datetime('now')
    """, (thread_id, username, title))
    conn.commit()
    conn.close()


@app.get("/api/conversations")
async def list_conversations(username: str = "anonymous"):
    """Returns list of past conversations for a user."""
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT thread_id, title, created_at, updated_at FROM conversation_meta WHERE username = ? ORDER BY updated_at DESC LIMIT 50",
        (username,)
    ).fetchall()
    conn.close()
    return [
        {"thread_id": r[0], "title": r[1], "created_at": r[2], "updated_at": r[3]}
        for r in rows
    ]


@app.get("/api/conversations/{thread_id}")
async def get_conversation(thread_id: str):
    """Returns message history for a specific conversation thread."""
    try:
        config = {"configurable": {"thread_id": thread_id}}
        state = await agent.aget_state(config)
        if not state or not state.values:
            raise HTTPException(status_code=404, detail="Conversation not found")

        messages = []
        for msg in state.values.get("messages", []):
            msg_type = getattr(msg, "type", "")
            content = getattr(msg, "content", "")
            if msg_type == "human":
                messages.append({"role": "user", "content": content})
            elif msg_type == "ai" and content:
                messages.append({"role": "assistant", "content": content})
        return {"thread_id": thread_id, "messages": messages}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching conversation {thread_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/conversations/{thread_id}")
async def delete_conversation(thread_id: str):
    """Deletes a conversation from metadata (checkpointer data remains but is orphaned)."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM conversation_meta WHERE thread_id = ?", (thread_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
