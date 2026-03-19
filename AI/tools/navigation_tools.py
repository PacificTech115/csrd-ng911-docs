"""
Navigation context tool — helps the agent construct navigation commands
that the frontend renders as clickable buttons.
"""

from langchain_core.tools import tool

# Mapping of topics/keywords to routes and element IDs.
# This is the agent's knowledge of where things live in the web app.
NAVIGATION_MAP = {
    # Schema fields → schema-guide page with element IDs
    "agency": {"route": "schema-guide", "element": "field-Agency", "label": "Agency field"},
    "discrpagid": {"route": "schema-guide", "element": "field-DiscrpAgID", "label": "DiscrpAgID field"},
    "add_number": {"route": "schema-guide", "element": "field-Add_Number", "label": "Add_Number field"},
    "st_name": {"route": "schema-guide", "element": "field-St_Name", "label": "St_Name field"},
    "a3": {"route": "schema-guide", "element": "field-A3", "label": "A3 (Locality) field"},
    "unit": {"route": "schema-guide", "element": "field-Unit", "label": "Unit field"},
    "addnum_pre": {"route": "schema-guide", "element": "field-AddNum_Pre", "label": "AddNum_Pre field"},
    "addnum_suf": {"route": "schema-guide", "element": "field-AddNum_Suf", "label": "AddNum_Suf field"},
    "st_premod": {"route": "schema-guide", "element": "field-St_PreMod", "label": "St_PreMod field"},
    "st_predir": {"route": "schema-guide", "element": "field-St_PreDir", "label": "St_PreDir field"},
    "st_pretyp": {"route": "schema-guide", "element": "field-St_PreTyp", "label": "St_PreTyp field"},
    "st_presep": {"route": "schema-guide", "element": "field-St_PreSep", "label": "St_PreSep field"},
    "st_postyp": {"route": "schema-guide", "element": "field-St_PosTyp", "label": "St_PosTyp field"},
    "st_posdir": {"route": "schema-guide", "element": "field-St_PosDir", "label": "St_PosDir field"},
    "st_posmod": {"route": "schema-guide", "element": "field-St_PosMod", "label": "St_PosMod field"},
    "nguid": {"route": "schema-guide", "element": "field-NGUID", "label": "NGUID field"},
    "latitude": {"route": "schema-guide", "element": "field-Latitude", "label": "Latitude field"},
    "longitude": {"route": "schema-guide", "element": "field-Longitude", "label": "Longitude field"},
    "qa_status": {"route": "schema-guide", "element": "field-QA_Status", "label": "QA_Status field"},
    "dateupdate": {"route": "schema-guide", "element": "field-DateUpdate", "label": "DateUpdate field"},
    "addcode": {"route": "schema-guide", "element": "field-AddCode", "label": "AddCode field"},
    "full_address": {"route": "schema-guide", "element": "field-Full_Address", "label": "Full_Address field"},

    # Attribute rules → dedicated rule pages
    "full address rule": {"route": "rule-full-address", "label": "Full Address Rule"},
    "nguid rule": {"route": "rule-nguid", "label": "NGUID Rule"},
    "longitude rule": {"route": "rule-longitude", "label": "Longitude Rule"},
    "latitude rule": {"route": "rule-latitude", "label": "Latitude Rule"},
    "addcode rule": {"route": "rule-addcode", "label": "AddCode Rule"},
    "dateupdate rule": {"route": "rule-dateupdate", "label": "DateUpdate Rule"},
    "qastatus rule": {"route": "rule-qastatus", "label": "QAStatus Rule"},
    "default agency rule": {"route": "rule-defaultagency", "label": "Default Agency Rule"},
    "mandatory rule": {"route": "rule-mandatory", "label": "Mandatory Fields Rule"},

    # Pages
    "schema guide": {"route": "schema-guide", "label": "Schema Guide"},
    "schema": {"route": "schema-guide", "label": "Schema Guide"},
    "attribute rules": {"route": "attribute-rules", "label": "Attribute Rules"},
    "domains": {"route": "domains", "label": "Domain Tables"},
    "architecture": {"route": "architecture", "label": "Architecture Overview"},
    "automations dashboard": {"route": "automations-dashboard", "label": "Automations Dashboard"},
    "automations": {"route": "automations-dashboard", "label": "Automations Dashboard"},
    "gp tools": {"route": "gp-tools", "label": "GP Tools"},
    "power automate": {"route": "power-automate", "label": "Power Automate"},
    "maintenance": {"route": "maintenance", "label": "Maintenance Guide"},
    "system resources": {"route": "system-resources", "label": "System Resources"},
    "sync app": {"route": "sync-app", "label": "Data Sync App"},
    "data sync": {"route": "sync-app", "label": "Data Sync App"},

    # Scripts
    "nightly pipeline": {"route": "script-orchestrator", "label": "Nightly Orchestrator"},
    "orchestrator": {"route": "script-orchestrator", "label": "Nightly Orchestrator"},
    "salmon arm etl": {"route": "script-etl", "label": "Salmon Arm ETL"},
    "etl": {"route": "script-etl", "label": "Salmon Arm ETL"},
    "qa validation": {"route": "script-qa", "label": "QA Validation Tool"},
    "reconcile post": {"route": "script-reconcile", "label": "Reconcile/Post Tool"},
    "export": {"route": "script-export", "label": "Export FGDB Tool"},

    # Municipal guides
    "revelstoke": {"route": "revelstoke", "label": "Revelstoke Guide"},
    "golden": {"route": "golden", "label": "Golden Guide"},
    "salmon arm": {"route": "salmonarm", "label": "Salmon Arm Guide"},
    "sicamous": {"route": "sicamous", "label": "Sicamous Guide"},

    # Domain tables (scroll targets on domains page)
    "agency domain": {"route": "domains", "element": "tbl-agency", "label": "Agency Domain Table"},
    "discrpagid domain": {"route": "domains", "element": "tbl-discrpagid", "label": "DiscrpAgID Domain Table"},
    "locality domain": {"route": "domains", "element": "tbl-locality", "label": "Locality Domain Table"},
    "addcode domain": {"route": "domains", "element": "tbl-addcode", "label": "AddCode Lookup Table"},
}


@tool
def get_navigation_target(topic: str) -> str:
    """Find the best web app page and element to navigate the user to for a given topic.
    Use this when you want to direct the user to a specific page or field in the Documentation Hub.
    - topic: what the user wants to see (e.g., 'St_PreTyp', 'NGUID rule', 'GP tools', 'domains')
    Returns the navigation syntax to embed in your response.
    """
    topic_lower = topic.lower().strip()

    # Try exact match first
    if topic_lower in NAVIGATION_MAP:
        entry = NAVIGATION_MAP[topic_lower]
        return _format_nav(entry)

    # Try partial/fuzzy matching
    best_match = None
    best_score = 0
    for key, entry in NAVIGATION_MAP.items():
        # Check if topic is a substring of key or vice versa
        if topic_lower in key or key in topic_lower:
            score = len(key)  # Prefer longer (more specific) matches
            if score > best_score:
                best_score = score
                best_match = entry

    if best_match:
        return _format_nav(best_match)

    return (
        f"No specific navigation target found for '{topic}'. "
        f"You can still use {{{{nav:ROUTE#ELEMENT_ID|Label}}}} syntax manually "
        f"if you know the correct route from the route map in your system prompt."
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
