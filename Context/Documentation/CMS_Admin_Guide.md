# CMS Admin Guide

The NG911 Documentation Hub uses an ArcGIS Hosted Table as its Content Management System (CMS). Admins can edit page content directly in the browser without modifying code.

## CMS Architecture

**Backend:** ArcGIS Hosted Table at `NG911_Docs_CMS/FeatureServer/0`

The table has three key fields:
- **KeyName**: Unique content identifier (e.g., `home.heroTitle`, `revelstoke.heroSubtitle`)
- **ContentValue**: The actual content, stored as Base64-encoded HTML or text
- **ContentType**: Either `html`, `text`, or `url`

Content is Base64-encoded before storage to bypass ArcGIS Online XSS filters that would strip HTML tags.

## Content Key Naming Convention

Keys follow a `{page}.{element}` pattern:

| Key Prefix | Page |
|-----------|------|
| `home.*` | Home page content |
| `revelstoke.*` | Revelstoke municipal guide |
| `golden.*` | Golden municipal guide |
| `salmonarm.*` | Salmon Arm municipal guide |
| `sicamous.*` | Sicamous municipal guide |
| `dashboard.orchestrator.*` | Automations Dashboard pipeline data |
| `dashboard.etl.*` | Automations Dashboard ETL data |

## How Content Gets Applied

When a page loads, the CMS system:

1. Fetches all content from the Hosted Table in one batch
2. Scans the page HTML for elements with CMS attributes
3. Replaces content based on attribute type:

| HTML Attribute | What It Does | Example |
|---------------|-------------|---------|
| `data-cms-key="home.heroTitle"` | Replaces element's text/HTML content | `<h1 data-cms-key="home.heroTitle">Default Title</h1>` |
| `data-cms-html="home.quickActionsGrid"` | Replaces entire inner HTML of the element | `<div data-cms-html="home.quickActionsGrid">...</div>` |
| `data-cms-href="home.navSchema.link"` | Replaces the element's href attribute | `<a data-cms-href="home.navSchema.link" href="#">Link</a>` |

## How to Edit Content (Admin Only)

### Enabling Editor Mode

1. Log in as an admin user (csrd_service, csrd_gis, dmajor@csrd, or any username containing "admin")
2. In the sidebar, find the "Edit Docs" toggle switch
3. Turn it on -- editor mode activates

### Editing Text Content

1. With editor mode on, click any text element that has a CMS key
2. The element becomes editable with a yellow highlight
3. Type your changes directly
4. Changes are tracked automatically

### Editing Structural Blocks

For `data-cms-html` blocks, an action bar appears with:
- Move Up / Move Down buttons (reorder content blocks)
- Duplicate button (clone a block)
- Delete button (remove a block)
- You can also edit the HTML content directly

### Editing Links

Clicking a link inside a CMS block opens an inline URL editor where you can change the link destination.

### Saving Changes

1. Click the "Save Page" button in the editor toolbar
2. All tracked edits are Base64-encoded
3. The encoded content is sent to the ArcGIS Hosted Table via the `applyEdits` REST API
4. The page reloads to show the updated content

### Editor Toolbar Features

- Undo / Redo
- Bold, Italic, Underline, Strikethrough
- Insert Link
- Add Text Block (new paragraph)
- Add Header (new h3)
- Delete Block
- Save Page

## Important Notes

- Editor mode blocks navigation links and buttons while active (a toast warning appears if you try to navigate). Save or exit editor mode before navigating.
- The CMS only stores content that has been explicitly edited. Default content comes from the HTML partial files.
- Dashboard data (pipeline run results, ETL status) is also stored in the CMS table as Base64-encoded JSON, written by the Orchestrator and ETL scripts via Power Automate webhooks.
- If edits are not appearing after saving, try a hard refresh (Ctrl+Shift+R) to clear the browser cache.
