import streamlit as st
import uuid
import sys
import os
import time

CONTEXT_LIMIT = 65536

# Ensure the AI root is on the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from langchain_core.messages import HumanMessage, AIMessage, AIMessageChunk
from agent import agent  # single ReAct agent

# ── Page Config ──────────────────────────────────────────────────────
st.set_page_config(
    page_title="NG911 CSRD AI Assistant",
    page_icon="🤖",
    layout="wide",
)

st.title("NG911 CSRD Central Database — AI Assistant")
st.markdown(
    """
This AI agent has **direct read access** to every file in the NG911 system and can help with:
- **Database Schema** — fields, domains, feature classes
- **Arcade Attribute Rules** — authoring, debugging, optimization
- **Automation Scripts** — nightly pipeline, GP tools, Salmon Arm ETL
- **QA & Troubleshooting** — validation logic, error resolution
- **Documentation Hub** — SPA architecture, CMS, RBAC patterns
"""
)

# ── Sidebar ──────────────────────────────────────────────────────────
with st.sidebar:
    st.header("Session")
    if st.button("Clear conversation"):
        st.session_state.messages = []
        st.session_state.thread_id = str(uuid.uuid4())
        st.session_state.context_used = 0
        st.rerun()
    st.caption(f"Thread: `{st.session_state.get('thread_id', 'new')[:8]}...`")

    # -- Context Window Tracker --
    st.markdown("---")
    st.subheader("Context Window")
    ctx_used = st.session_state.get("context_used", 0)
    ctx_pct = min(ctx_used / CONTEXT_LIMIT, 1.0) if CONTEXT_LIMIT > 0 else 0

    st.progress(ctx_pct)
    st.caption(f"{ctx_used:,} / {CONTEXT_LIMIT:,} tokens ({ctx_pct:.0%})")

    if ctx_pct >= 0.85:
        st.error(
            "Context nearly full. The model may lose earlier conversation "
            "details. Clear the conversation to reset."
        )
    elif ctx_pct >= 0.65:
        st.warning("Context usage is high. Consider clearing soon.")

# ── Session State ────────────────────────────────────────────────────
if "messages" not in st.session_state:
    st.session_state.messages = []
if "thread_id" not in st.session_state:
    st.session_state.thread_id = str(uuid.uuid4())
if "context_used" not in st.session_state:
    st.session_state.context_used = 0

# ── Render History ───────────────────────────────────────────────────
for msg in st.session_state.messages:
    role = "user" if isinstance(msg, HumanMessage) else "assistant"
    with st.chat_message(role):
        st.markdown(msg.content)

# ── Chat Input & Agent Execution ─────────────────────────────────────
if user_query := st.chat_input("Ask about the NG911 system…"):
    with st.chat_message("user"):
        st.markdown(user_query)
    st.session_state.messages.append(HumanMessage(content=user_query))

    with st.chat_message("assistant"):
        placeholder = st.empty()
        status_area = st.empty()

        with st.spinner("Thinking…"):
            try:
                config = {
                    "configurable": {"thread_id": st.session_state.thread_id}
                }
                full_response = ""
                total_input = 0
                total_output = 0
                tools_called = []
                start = time.time()

                # Track which message IDs we already displayed
                seen_ids = {
                    m.id
                    for m in st.session_state.messages
                    if hasattr(m, "id") and m.id
                }

                for event in agent.stream(
                    {"messages": [HumanMessage(content=user_query)]},
                    config=config,
                    stream_mode="messages",
                ):
                    msg = event[0]
                    metadata = event[1]

                    # Accumulate token metrics
                    if hasattr(msg, "usage_metadata") and msg.usage_metadata:
                        total_input += msg.usage_metadata.get("input_tokens", 0)
                        total_output += msg.usage_metadata.get("output_tokens", 0)

                    # Track tool calls for the status ribbon
                    if hasattr(msg, "tool_calls") and msg.tool_calls:
                        for tc in msg.tool_calls:
                            name = tc.get("name", "")
                            if name and name not in tools_called:
                                tools_called.append(name)
                                status_area.caption(
                                    f"Using tool: {name}"
                                )

                    # Skip already-seen messages
                    if getattr(msg, "id", None) in seen_ids:
                        continue

                    # Stream AI text (skip tool messages and internal routing)
                    if msg.content and isinstance(msg, (AIMessage, AIMessageChunk)):
                        if isinstance(msg, AIMessageChunk):
                            full_response += msg.content
                            placeholder.markdown(full_response + "▌")
                        else:
                            full_response = msg.content
                            placeholder.markdown(full_response)

                placeholder.markdown(full_response)

                # Performance ribbon
                duration = time.time() - start
                tok_s = total_output / duration if duration > 0 else 0
                st.caption(
                    f"{duration:.1f}s | "
                    f"qwen3.5:35b | "
                    f"{total_input} in / {total_output} out ({tok_s:.0f} tok/s) | "
                    f"Tools: {', '.join(tools_called) or 'none'}"
                )

                # Update context tracker
                if total_input > 0:
                    st.session_state.context_used = total_input

                st.session_state.messages.append(AIMessage(content=full_response))

            except Exception as exc:
                st.error(f"Agent error: {exc}")
                import traceback
                st.code(traceback.format_exc())
