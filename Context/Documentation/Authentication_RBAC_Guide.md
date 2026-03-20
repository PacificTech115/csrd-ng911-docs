# Authentication & Role-Based Access Control

The NG911 Documentation Hub uses ArcGIS Enterprise OAuth 2.0 for authentication and applies role-based access control (RBAC) to pages, features, and UI elements.

## Login Flow

1. User visits `apps.csrd.bc.ca/ng911`
2. If no valid token exists in localStorage, the login screen is displayed
3. User clicks "Sign In" which redirects to ArcGIS Enterprise OAuth 2.0 (Implicit Grant flow)
4. Portal URL: `https://apps.csrd.bc.ca/hub`
5. App Client ID: `vWXtjJtA7k006M4S`
6. On successful authentication, a token is stored in localStorage with 1440-minute (24-hour) expiration
7. User info is saved to `localStorage.csrd_arcgis_user` as JSON with username and token

## Role Detection

### Admin Users

A user is considered an admin if their username matches any of these:
- `csrd_service`
- `csrd_gis`
- `dmajor@csrd`
- `csrd`
- Any username containing the word `admin`

### Municipal Users

Municipality is detected by checking if the username contains a municipality keyword:

| Username contains | Municipality |
|-------------------|-------------|
| `revelstoke` | Revelstoke |
| `golden` | Golden |
| `salmonarm` or `salmon_arm` | Salmon Arm |
| `sicamous` | Sicamous |

Example: username `revelstoke_editing` is detected as a Revelstoke municipal user.

### User Context Object

The web app builds a user context object sent with every AI chat request:

```
{
  username: "revelstoke_editing",
  is_admin: false,
  municipality: "revelstoke",
  current_page: "schema-guide"
}
```

## Page Access Rules

### Pages visible to ALL authenticated users:
- Home (`#`)
- Architecture (`#architecture`)
- Schema Guide (`#schema-guide`)
- Attribute Rules (`#attribute-rules`) and all 9 individual rule pages
- Domains (`#domains`)

### Pages visible to ADMIN users only:
- Automation Scripts (`#automation-scripts`)
- Automations Dashboard (`#automations-dashboard`)
- GP Tools (`#gp-tools`)
- Power Automate (`#power-automate`)
- All 5 script execution pages (`#script-orchestrator`, `#script-etl`, `#script-qa`, `#script-reconcile`, `#script-export`)
- Maintenance (`#maintenance`)
- System Resources (`#system-resources`)
- Version Edits (`#version-edits`)
- Quick Reference (`#quick-reference`)

### Pages visible to MUNICIPAL users (their municipality only) + ADMINS:
- Revelstoke Guide (`#revelstoke`) -- visible to Revelstoke users and admins
- Golden Guide (`#golden`) -- visible to Golden users and admins
- Salmon Arm Guide (`#salmonarm`) -- visible to Salmon Arm users and admins
- Sicamous Guide (`#sicamous`) -- visible to Sicamous users and admins
- Sync App (`#sync-app`) -- visible to all municipal users and admins

### How Access is Enforced

1. **Sidebar navigation** is built dynamically -- only shows links to pages the user can access
2. **Page RBAC check** runs on every route change -- admin-only elements (`data-admin-only="true"`) are removed from the DOM for non-admins
3. **Home page quick actions** are filtered to show only the user's relevant download buttons
4. **GP Runner UI** only renders on script pages for admin users

## Sidebar Branding

Municipal users see custom sidebar branding for their municipality:
- Revelstoke: City of Revelstoke logo
- Golden: Town of Golden logo
- Salmon Arm: City of Salmon Arm logo
- Sicamous: District of Sicamous logo

Admins see the default CSRD branding.

## Editor Mode Access

Only admin users see the "Edit Docs" toggle in the sidebar. This enables the CMS editor mode for inline content editing. See `CMS_Admin_Guide.md` for details.
