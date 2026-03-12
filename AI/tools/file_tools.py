"""
Read-only file system tools for the NG911 AI Agent.
These tools let the agent browse and read project files but NEVER write or modify them.
"""

import os
import re
from langchain_core.tools import tool

_raw_root = os.getenv(
    "PROJECT_ROOT",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data"),
)
# Resolve to absolute at load time so _safe_resolve comparisons work correctly
PROJECT_ROOT = os.path.normpath(os.path.abspath(_raw_root))


def _safe_resolve(path: str) -> str:
    """
    Resolves a path relative to PROJECT_ROOT and ensures it stays inside the
    project boundary.  Raises ValueError for escape attempts.
    """
    if os.path.isabs(path):
        resolved = os.path.normpath(path)
    else:
        resolved = os.path.normpath(os.path.join(PROJECT_ROOT, path))

    if not resolved.lower().startswith(PROJECT_ROOT.lower()):
        raise ValueError(
            f"Access denied: path '{path}' resolves outside the project root."
        )
    return resolved


@tool
def read_file(file_path: str) -> str:
    """Read the full contents of a file in the NG911 project.
    Accepts absolute paths or paths relative to the project root.
    Use this to inspect scripts, Arcade rules, configuration files, or documentation.
    Returns the complete file text (capped at 30 000 characters for safety).
    """
    resolved = _safe_resolve(file_path)
    if not os.path.isfile(resolved):
        return f"Error: '{file_path}' is not a file or does not exist."
    try:
        with open(resolved, "r", encoding="utf-8", errors="replace") as f:
            content = f.read(30_000)
        if len(content) == 30_000:
            content += "\n\n... [truncated at 30 000 characters]"
        return content
    except Exception as exc:
        return f"Error reading file: {exc}"


@tool
def list_directory(directory_path: str) -> str:
    """List all files and subdirectories inside a project folder.
    Accepts absolute paths or paths relative to the project root.
    Returns a formatted listing showing names and types (file / dir).
    """
    resolved = _safe_resolve(directory_path)
    if not os.path.isdir(resolved):
        return f"Error: '{directory_path}' is not a directory or does not exist."
    try:
        entries = sorted(os.listdir(resolved))
        lines = []
        for entry in entries:
            full = os.path.join(resolved, entry)
            kind = "dir" if os.path.isdir(full) else "file"
            size = ""
            if kind == "file":
                try:
                    size = f"  ({os.path.getsize(full):,} bytes)"
                except OSError:
                    pass
            lines.append(f"  [{kind}] {entry}{size}")
        header = f"Contents of {resolved}  ({len(entries)} items):\n"
        return header + "\n".join(lines) if lines else header + "  (empty)"
    except Exception as exc:
        return f"Error listing directory: {exc}"


@tool
def search_codebase(pattern: str, extensions: str = "py,txt,js,html,md") -> str:
    """Search all project files for a text pattern (case-insensitive).
    - pattern: the text or regex to look for.
    - extensions: comma-separated list of file extensions to include (default: py,txt,js,html,md).
    Returns up to 20 matches with file path, line number, and matching line.
    """
    ext_set = {e.strip().lower().lstrip(".") for e in extensions.split(",")}
    try:
        regex = re.compile(pattern, re.IGNORECASE)
    except re.error:
        regex = re.compile(re.escape(pattern), re.IGNORECASE)

    matches = []
    skip_dirs = {"venv", "__pycache__", "node_modules", ".git", "chroma_db", "Archive"}

    for root, dirs, files in os.walk(PROJECT_ROOT):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fname in files:
            ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
            if ext not in ext_set:
                continue
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                    for lineno, line in enumerate(f, 1):
                        if regex.search(line):
                            display_path = os.path.relpath(fpath, PROJECT_ROOT)
                            matches.append(
                                f"{display_path}:{lineno}  {line.rstrip()[:120]}"
                            )
                            if len(matches) >= 20:
                                break
            except Exception:
                continue
            if len(matches) >= 20:
                break
        if len(matches) >= 20:
            break

    if not matches:
        return f"No matches found for '{pattern}'."
    header = f"Found {len(matches)} match(es) for '{pattern}':\n\n"
    return header + "\n".join(matches)
