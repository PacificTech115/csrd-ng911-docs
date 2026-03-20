"""
NG911 Central Database AI Agent
Single ReAct agent with read-only file tools and knowledge base search.
Replaces the previous 7-agent supervisor pattern.
"""

from langchain_core.messages import ToolMessage, SystemMessage
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
import os
from core.llm_config import get_llm
from tools.file_tools import read_file, list_directory, search_codebase
from tools.knowledge_tools import search_knowledge_base
from tools.cms_tools import query_cms_content
from tools.navigation_tools import get_navigation_target

# ─── Dynamic File Map Builder ────────────────────────────────────────
import glob as _glob

_REPO_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
_NG911 = os.path.join(_REPO_ROOT, "NG911System")


def _build_file_map():
    """Scan the repo at startup to build a dynamic file map for the system prompt."""
    sections = []

    # Attribute Rules
    rules_dir = os.path.join(_NG911, "Database Scripts", "0.Attribute Rules")
    rules = sorted(_glob.glob(os.path.join(rules_dir, "*.txt")))
    if rules:
        lines = ["ATTRIBUTE RULES (Arcade expressions on SDE.NG911_SiteAddress):"]
        for r in rules:
            name = os.path.splitext(os.path.basename(r))[0]
            rel = os.path.relpath(r, _REPO_ROOT).replace("\\", "/")
            lines.append(f"  {name} → {rel}")
        sections.append("\n".join(lines))

    # Automation Scripts
    auto_dir = os.path.join(_NG911, "Database Scripts", "1.ReconcilePost-QA-Export")
    scripts = sorted(_glob.glob(os.path.join(auto_dir, "*.py")))
    if scripts:
        lines = ["AUTOMATION SCRIPTS (Python / ArcPy):"]
        for s in scripts:
            name = os.path.splitext(os.path.basename(s))[0]
            rel = os.path.relpath(s, _REPO_ROOT).replace("\\", "/")
            lines.append(f"  {name} → {rel}")
        sections.append("\n".join(lines))

    # Salmon Arm ETL
    etl_dir = os.path.join(_NG911, "Database Scripts", "2. Salmon Arm Sync")
    etl_scripts = sorted(_glob.glob(os.path.join(etl_dir, "*.py")))
    if etl_scripts:
        lines = ["SALMON ARM ETL:"]
        for s in etl_scripts:
            name = os.path.splitext(os.path.basename(s))[0]
            rel = os.path.relpath(s, _REPO_ROOT).replace("\\", "/")
            lines.append(f"  {name} → {rel}")
        sections.append("\n".join(lines))

    # Power Automate Templates
    pa_files = sorted(
        _glob.glob(os.path.join(auto_dir, "*.html"))
        + _glob.glob(os.path.join(etl_dir, "*.html"))
    )
    if pa_files:
        lines = ["POWER AUTOMATE TEMPLATES:"]
        for f in pa_files:
            name = os.path.splitext(os.path.basename(f))[0]
            rel = os.path.relpath(f, _REPO_ROOT).replace("\\", "/")
            lines.append(f"  {name} → {rel}")
        sections.append("\n".join(lines))

    # Documentation
    sections.append(
        "DATABASE SCHEMA:\n"
        "  Full 61-field Schema → Documentation/Database_Schema_Summary.md\n\n"
        "SYSTEM DEPENDENCIES (Portal items, REST endpoints, UNC paths):\n"
        "  All Services & Paths → Documentation/System_Dependencies.md"
    )

    # Web App JS modules
    webapp_dir = os.path.join(_REPO_ROOT, "Web App", "docs")
    js_files = sorted(_glob.glob(os.path.join(webapp_dir, "*.js")))
    # Exclude auto-generated search-data.js
    js_files = [f for f in js_files if "search-data" not in os.path.basename(f)]
    if js_files:
        lines = ["WEB APP (Documentation Hub SPA):"]
        for f in js_files:
            name = os.path.splitext(os.path.basename(f))[0]
            rel = os.path.relpath(f, _REPO_ROOT).replace("\\", "/")
            lines.append(f"  {name} → {rel}")
        # Also include the stylesheet
        lines.append(f"  shared.css → Web App/docs/shared.css")
        sections.append("\n".join(lines))

    return "\n\n".join(sections)


_FILE_MAP = _build_file_map()

# ─── System Prompt ───────────────────────────────────────────────────
SYSTEM_PROMPT = f"""\
You are the **NG911 Central Database AI Assistant**, the expert system for the \
Columbia Shuswap Regional District (CSRD) NG911 Addressing System built by \
Pacific Tech Systems.

You can help with:
- Database schema questions (61-field NENA SSAP SiteAddress feature class)
- Arcade attribute rule authoring, debugging, and optimization
- Python/ArcPy automation scripts (nightly pipeline, GP tools, ETL)
- QA validation logic and troubleshooting
- System architecture, versioning hierarchy, and maintenance
- Power Automate notification workflows
- Documentation Hub (SPA) code and CMS patterns

For architecture questions, use search_knowledge_base('architecture') to find Master_Context.md.

═══════════════════════════════════════════════════════════════
 FILE MAP — Use read_file() with these paths to get exact source code
═══════════════════════════════════════════════════════════════

{_FILE_MAP}

═══════════════════════════════════════════════════════════════
 RESPONSE RULES
═══════════════════════════════════════════════════════════════

TOOL USAGE:
1. ALWAYS use read_file() to read the actual source before answering code questions.
   Do NOT guess at code — read the real file first.
2. When asked to write NEW code, read existing files first to match conventions.
3. For schema questions, read the Database Schema Summary.
4. Use search_codebase() to find WHERE something is defined.
5. Use search_knowledge_base() only for broad or ambiguous questions.
6. You are READ-ONLY — present code in responses for the user to save manually.

FORMATTING AND TONE — FOLLOW STRICTLY:
7. Write like a senior GIS engineer: precise, direct, professional.
8. NEVER use emojis OR unicode symbols (no ✅❌⚠️📋🔴🟢 etc.). Plain text only.
9. Keep answers SHORT but COMPLETE. Get to the point immediately.
   - Simple factual questions: 1-3 sentences max.
   - List/table questions: use a table, no extra commentary before or after.
   - Code questions: show the code with brief inline comments. No preamble paragraphs.
   - Troubleshooting: numbered steps only. No filler.
10. Use clean markdown formatting: tables, headers, fenced code blocks.
    Do not overuse bold. Do not use horizontal rules between every section.
11. Cite the source file path once, inline. Do not repeat it.
12. Do NOT add a summary or wrap-up paragraph at the end.
13. Do NOT say "Let me know if you need anything else" or ask follow-up questions.
14. When listing items, prefer a compact table over verbose bullet points.
15. ANSWER ONLY WHAT WAS ASKED. Do not volunteer unsolicited code reviews,
    audits, improvements, or checklists unless the user explicitly asks for them.
16. When the user asks to SEE or SHOW code/templates/rules, return the file
    content VERBATIM inside a fenced code block. Do not rewrite, improve, or
    critique it. Just show the source with its file path.
17. If asked about Portal IDs, REST endpoints, web apps, feature services, or
    any system dependencies, ALWAYS use read_file('Documentation/System_Dependencies.md') FIRST.

═══════════════════════════════════════════════════════════════
 USER AWARENESS & NAVIGATION
═══════════════════════════════════════════════════════════════

USER CONTEXT: A [CURRENT USER] message may precede each query. Tailor answers to \
the user's role (admin sees everything, municipal users see only their municipality).

NAVIGATION: The backend automatically appends navigation buttons to your responses. \
You do not need to add them yourself.
"""

# ─── Tools ───────────────────────────────────────────────────────────
ALL_TOOLS = [
    read_file,
    list_directory,
    search_codebase,
    search_knowledge_base,
    query_cms_content,
    get_navigation_target,
]

# ─── Message Trimmer ─────────────────────────────────────────────────
RECENT_WINDOW = 4  # keep the last N messages fully intact


def trim_messages(state):
    """
    Prevents context explosion by trimming old tool results.
    - Pre-pends the SYSTEM_PROMPT.
    - Preserves [CURRENT USER] SystemMessages injected by api.py.
    - Keeps the last RECENT_WINDOW messages untouched.
    - For older messages, drops ToolMessage content (file reads, search
      results) since those are the biggest context consumers.
    """
    msgs = state.get("messages", [])
    sys_msg = SystemMessage(content=SYSTEM_PROMPT)

    # Extract any user-context SystemMessages from the input (injected by api.py)
    user_ctx_msgs = [
        m for m in msgs
        if isinstance(m, SystemMessage) and "[CURRENT USER]" in m.content
    ]
    # Filter them out of the main message flow (we'll prepend them after SYSTEM_PROMPT)
    msgs = [m for m in msgs if m not in user_ctx_msgs]

    prefix = [sys_msg] + user_ctx_msgs

    if len(msgs) <= RECENT_WINDOW:
        return prefix + msgs

    old = msgs[:-RECENT_WINDOW]
    recent = msgs[-RECENT_WINDOW:]

    trimmed = []
    for m in old:
        if hasattr(m, "tool_call_id") and m.type == "tool":
            trimmed.append(
                ToolMessage(
                    content="[output trimmed to save context]",
                    tool_call_id=m.tool_call_id,
                    name=getattr(m, "name", ""),
                )
            )
        else:
            trimmed.append(m)

    return prefix + trimmed + recent


# ─── Agent ───────────────────────────────────────────────────────────
llm = get_llm()

# SQLite checkpointer persists conversations across restarts
DB_PATH = os.path.join(os.path.dirname(__file__), "database", "conversations.db")


def create_agent(checkpointer):
    """Create the agent with the given checkpointer."""
    return create_react_agent(
        llm,
        tools=ALL_TOOLS,
        prompt=trim_messages,
        checkpointer=checkpointer,
    )
