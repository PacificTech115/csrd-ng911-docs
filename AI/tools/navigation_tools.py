"""
Dynamic Navigation Context Tool.
Scans the Web App's router.js and HTML partials at startup to build
a live navigation map. No more hard-coded routes or field IDs.
Rebuilds automatically when /api/reingest is called.
"""

import os
import re
import logging
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# Resolve paths relative to the AI/ directory
_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_REPO_ROOT = os.path.normpath(os.path.join(_AI_DIR, ".."))
_WEBAPP_DIR = os.path.join(_REPO_ROOT, "Web App", "docs")
_PARTIALS_DIR = os.path.join(_WEBAPP_DIR, "partials")
_ROUTER_JS = os.path.join(_WEBAPP_DIR, "router.js")

# Module-level cache — rebuilt by build_navigation_map()
NAVIGATION_MAP: dict[str, dict] = {}


def _humanize_route(route: str) -> str:
    """Convert 'rule-full-address' → 'Full Address Rule', 'schema-guide' → 'Schema Guide'."""
    if route.startswith("rule-"):
        rule_name = route[5:].replace("-", " ").title()
        return f"{rule_name} Rule"
    if route.startswith("script-"):
        script_name = route[7:].replace("-", " ").title()
        return f"{script_name} Script"
    return route.replace("-", " ").title()


def _scan_routes() -> dict[str, str]:
    """Parse router.js to extract all route → partial mappings."""
    routes = {}
    try:
        with open(_ROUTER_JS, "r", encoding="utf-8") as f:
            content = f.read()
        # Match patterns like: 'schema-guide': 'schema-guide.html'
        for m in re.finditer(r"'([a-z0-9-]+)'\s*:\s*'([^']+\.html)'", content):
            routes[m.group(1)] = m.group(2)
    except Exception as e:
        logger.error(f"Failed to scan router.js: {e}")
    return routes


def _scan_element_ids(partial_file: str) -> list[str]:
    """Extract all id="..." values from an HTML partial."""
    ids = []
    try:
        filepath = os.path.join(_PARTIALS_DIR, partial_file)
        if not os.path.exists(filepath):
            return ids
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        for m in re.finditer(r'id="([^"]+)"', content):
            ids.append(m.group(1))
    except Exception as e:
        logger.error(f"Failed to scan {partial_file}: {e}")
    return ids


def build_navigation_map() -> dict[str, dict]:
    """
    Build the full navigation map dynamically by scanning:
    1. router.js for all routes
    2. Each HTML partial for element IDs (field-*, tbl-*, section-*, etc.)

    Populates both route-level entries (e.g., "schema guide" → schema-guide)
    and element-level entries (e.g., "st_pretyp" → schema-guide#field-St_PreTyp).
    """
    global NAVIGATION_MAP
    nav = {}
    routes = _scan_routes()

    logger.info(f"Building dynamic navigation map from {len(routes)} routes...")

    for route, partial in routes.items():
        label = _humanize_route(route)

        # Add route-level entry (e.g., "schema guide" → schema-guide)
        route_key = route.replace("-", " ")
        nav[route_key] = {"route": route, "label": label}

        # Add common aliases
        if route == "schema-guide":
            nav["schema"] = {"route": route, "label": label}
        elif route == "automations-dashboard":
            nav["automations"] = {"route": route, "label": label}
            nav["dashboard"] = {"route": route, "label": label}
        elif route == "sync-app":
            nav["data sync"] = {"route": route, "label": label}
            nav["sync"] = {"route": route, "label": label}
        elif route == "gp-tools":
            nav["gp tools"] = {"route": route, "label": label}
            nav["geoprocessing"] = {"route": route, "label": label}
        elif route == "script-orchestrator":
            nav["nightly pipeline"] = {"route": route, "label": label}
            nav["orchestrator"] = {"route": route, "label": label}
        elif route == "script-etl":
            nav["salmon arm etl"] = {"route": route, "label": label}
            nav["etl"] = {"route": route, "label": label}
        elif route == "script-qa":
            nav["qa validation"] = {"route": route, "label": label}
        elif route == "script-reconcile":
            nav["reconcile post"] = {"route": route, "label": label}
            nav["reconcile"] = {"route": route, "label": label}
        elif route == "script-export":
            nav["export"] = {"route": route, "label": label}

        # Scan the partial for element IDs
        element_ids = _scan_element_ids(partial)
        for eid in element_ids:
            # field-St_PreTyp → keyword "st_pretyp", label "St_PreTyp field"
            if eid.startswith("field-"):
                field_name = eid[6:]  # e.g., "St_PreTyp"
                keyword = field_name.lower()
                nav[keyword] = {
                    "route": route,
                    "element": eid,
                    "label": f"{field_name} field",
                }
                # Also add with underscores replaced by spaces
                nav[keyword.replace("_", " ")] = {
                    "route": route,
                    "element": eid,
                    "label": f"{field_name} field",
                }

            # tbl-agency → keyword "agency domain", label "Agency Domain Table"
            elif eid.startswith("tbl-"):
                tbl_name = eid[4:].replace("-", " ").title()
                keyword = f"{tbl_name.lower()} domain"
                nav[keyword] = {
                    "route": route,
                    "element": eid,
                    "label": f"{tbl_name} Domain Table",
                }

            # section-* → keyword "section name", label "Section Name"
            elif eid.startswith("section-"):
                section_name = eid[8:].replace("-", " ").title()
                keyword = section_name.lower()
                nav[keyword] = {
                    "route": route,
                    "element": eid,
                    "label": section_name,
                }

    NAVIGATION_MAP = nav
    logger.info(f"Navigation map built: {len(nav)} entries from {len(routes)} routes")
    return nav


@tool
def get_navigation_target(topic: str) -> str:
    """Find the best web app page and element to navigate the user to for a given topic.
    Use this when you want to direct the user to a specific page or field in the Documentation Hub.
    - topic: what the user wants to see (e.g., 'St_PreTyp', 'NGUID rule', 'GP tools', 'domains')
    Returns the navigation syntax to embed in your response.
    """
    # Lazy-build on first call if map is empty
    if not NAVIGATION_MAP:
        build_navigation_map()

    topic_lower = topic.lower().strip()

    # Try exact match first
    if topic_lower in NAVIGATION_MAP:
        return _format_nav(NAVIGATION_MAP[topic_lower])

    # Try partial/fuzzy matching — prefer longer (more specific) matches
    best_match = None
    best_score = 0
    for key, entry in NAVIGATION_MAP.items():
        if topic_lower in key or key in topic_lower:
            score = len(key)
            if score > best_score:
                best_score = score
                best_match = entry

    if best_match:
        return _format_nav(best_match)

    return (
        f"No specific navigation target found for '{topic}'. "
        f"Available routes: {', '.join(sorted(set(e['route'] for e in NAVIGATION_MAP.values())))}"
    )


def _format_nav(entry: dict) -> str:
    route = entry["route"]
    element = entry.get("element", "")
    label = entry.get("label", route)

    if element:
        syntax = f"{{{{nav:{route}#{element}|{label}}}}}"
        return f"Navigation target found.\nRoute: #{route}\nElement: #{element}\nUse this syntax in your response: {syntax}"
    else:
        syntax = f"{{{{nav:{route}|{label}}}}}"
        return f"Navigation target found.\nRoute: #{route}\nUse this syntax in your response: {syntax}"


# Build the map on module import
build_navigation_map()
