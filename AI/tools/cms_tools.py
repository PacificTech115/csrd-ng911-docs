"""
Live CMS query tool — queries the ArcGIS Hosted Table backing the Documentation Hub.
Gives the agent real-time awareness of dynamic CMS content.
Uses service account credentials for automatic token generation and renewal.
"""

import os
import base64
import time
import logging
import requests
from langchain_core.tools import tool
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

CMS_TABLE_URL = os.getenv("CMS_TABLE_URL", "")
PORTAL_URL = os.getenv("ARCGIS_PORTAL_URL", "https://apps.csrd.bc.ca/hub")
SERVICE_USERNAME = os.getenv("ARCGIS_SERVICE_USERNAME", "")
SERVICE_PASSWORD = os.getenv("ARCGIS_SERVICE_PASSWORD", "")

# Token cache — module-level so it persists across tool invocations
_token_cache = {"token": None, "expires": 0}


def _get_token() -> str:
    """Get a valid ArcGIS token, generating or refreshing as needed."""
    # Return cached token if still valid (with 5-minute buffer)
    if _token_cache["token"] and time.time() < (_token_cache["expires"] - 300):
        return _token_cache["token"]

    if not SERVICE_USERNAME or not SERVICE_PASSWORD:
        raise ValueError("ARCGIS_SERVICE_USERNAME and ARCGIS_SERVICE_PASSWORD must be set in .env")

    resp = requests.post(
        f"{PORTAL_URL}/sharing/rest/generateToken",
        data={
            "username": SERVICE_USERNAME,
            "password": SERVICE_PASSWORD,
            "client": "referer",
            "referer": "https://ai.pacifictechsystems.ca",
            "expiration": 1440,  # 24 hours
            "f": "json",
        },
        timeout=15,
    )
    data = resp.json()

    if "error" in data:
        raise ValueError(f"Token generation failed: {data['error'].get('message', str(data['error']))}")

    token = data.get("token")
    expires = data.get("expires", 0)

    if not token:
        raise ValueError("Token generation returned empty token")

    # Cache it (expires is in milliseconds from ArcGIS)
    _token_cache["token"] = token
    _token_cache["expires"] = expires / 1000  # Convert to seconds
    logger.info("ArcGIS service token generated/renewed successfully")
    return token


def _decode_base64(text: str) -> str:
    """Attempt to decode Base64-encoded CMS content. Returns original if not Base64."""
    try:
        decoded = base64.b64decode(text).decode("utf-8")
        if any(c in decoded for c in ("<", " ", "\n")):
            return decoded
    except Exception:
        pass
    return text


@tool
def query_cms_content(search_key: str = "", search_text: str = "") -> str:
    """Query the live Documentation Hub CMS for current page content.
    Use this when asked about what the web app currently displays, or to look up
    dynamic content that may have been edited by admins.
    - search_key: exact or partial CMS key (e.g., 'home.heroTitle', 'schema.intro').
    - search_text: search within content values (partial text match).
    Provide at least one parameter. Returns matching CMS entries with keys and content.
    """
    if not CMS_TABLE_URL:
        return "Error: CMS_TABLE_URL not configured in .env file."
    if not search_key and not search_text:
        return "Error: Provide at least search_key or search_text."

    # Get a valid token (auto-generates/renews)
    try:
        token = _get_token()
    except ValueError as e:
        return f"Error: {e}"

    # Build the WHERE clause
    conditions = []
    if search_key:
        conditions.append(f"cms_key LIKE '%{search_key}%'")
    if search_text:
        conditions.append(f"cms_value LIKE '%{search_text}%'")
    where = " AND ".join(conditions)

    try:
        resp = requests.get(
            f"{CMS_TABLE_URL}/query",
            params={
                "where": where,
                "outFields": "cms_key,cms_value",
                "f": "json",
                "token": token,
                "resultRecordCount": 20,
            },
            timeout=15,
        )
        data = resp.json()

        if "error" in data:
            err_msg = data["error"].get("message", str(data["error"]))
            # If token expired mid-flight, clear cache and retry once
            if "token" in err_msg.lower() or "invalid" in err_msg.lower():
                _token_cache["token"] = None
                _token_cache["expires"] = 0
                try:
                    token = _get_token()
                    resp = requests.get(
                        f"{CMS_TABLE_URL}/query",
                        params={
                            "where": where,
                            "outFields": "cms_key,cms_value",
                            "f": "json",
                            "token": token,
                            "resultRecordCount": 20,
                        },
                        timeout=15,
                    )
                    data = resp.json()
                    if "error" in data:
                        return f"ArcGIS REST error after token refresh: {data['error'].get('message', str(data['error']))}"
                except Exception as retry_err:
                    return f"Error on token retry: {retry_err}"
            else:
                return f"ArcGIS REST error: {err_msg}"

        features = data.get("features", [])
        if not features:
            return f"No CMS entries found matching key='{search_key}' text='{search_text}'."

        results = []
        for feat in features:
            attrs = feat.get("attributes", {})
            key = attrs.get("cms_key", "")
            value = attrs.get("cms_value", "")
            decoded = _decode_base64(value) if value else "(empty)"
            if len(decoded) > 500:
                decoded = decoded[:500] + "... [truncated]"
            results.append(f"  {key}: {decoded}")

        return f"Found {len(features)} CMS entries:\n" + "\n".join(results)

    except requests.RequestException as e:
        return f"Error querying CMS: {e}"
