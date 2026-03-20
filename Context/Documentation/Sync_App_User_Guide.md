# Sync App User Guide

The Sync App (`#sync-app` in the Documentation Hub) is a browser-based tool for comparing a municipal Feature Service against the CSRD central database and applying inserts/updates. It uses a 3-step wizard workflow.

## Who Can Use It

- Municipal editing users (revelstoke_editing, golden_editing, etc.)
- Admin users (csrd_service, csrd_gis, etc.)

## Target Layer Detection

The app automatically determines which CSRD editing layer to sync into based on the logged-in username:

| Username contains | Target Layer |
|-------------------|-------------|
| revelstoke | NG911_Address_Revelstoke_Edit |
| golden | NG911_Address_Golden_Edit |
| salmonarm | NG911_Address_SalmonArm_Edit |
| sicamous | NG911_Address_Sicamous_Edit |
| (admin fallback) | NG911_Address_SalmonArm_Edit |

## Step 1: Verify URL

1. Paste the source Feature Service REST endpoint URL into the input field
   - Example: `https://services.arcgis.com/.../FeatureServer/0`
2. Click "Verify URL"
3. The app fetches the schema from both the source and CSRD target layers
4. Match field dropdowns are populated automatically
   - Source match field: typically GlobalID
   - Target match field: typically FeatureID
5. If verification succeeds, the "Extract & Compare" button becomes available

## Step 2: Extract & Compare

1. Click "Extract & Compare"
2. The app fetches all features from both source and target (paginated, 1000 records per request)
3. The cascading match engine runs:
   - Compares source GlobalID against target FeatureID
   - Strips system fields (ObjectID, GlobalID, created_date, etc.)
   - Detects attribute and geometry changes at the field level
4. Results are categorized:
   - **New records** (green): Source records not found in target (inserts)
   - **Modified records** (orange): Source records with different attribute/geometry values (updates)
   - **Unchanged**: Records that match exactly (no sync needed)
   - **Skipped**: Source records missing a GlobalID (cannot match)
5. A summary appears with stat cards showing counts for each category
6. A diff table shows each record with NGUID, address, and change details
7. A map displays green dots (new) and orange dots (modified) for spatial context
8. Click any stat card to filter the table to that category

## Step 3: Execute Sync

1. Review the diff table and map to confirm the changes are correct
2. Click "Execute Sync"
3. A confirmation dialog shows the target layer name
4. The app posts an `applyEdits` payload to the CSRD Feature Service:
   - Inserts for new records
   - Updates for modified records
5. A real-time terminal log shows progress with timestamps:
   - Success counts for adds and updates
   - Error details for any failures
6. On completion, a summary shows total successful adds, updates, and any errors

## Match Field Logic

The sync engine uses a cascading key match:
- Primary: Source GlobalID matched to Target FeatureID
- This allows tracking records across systems even when ObjectIDs differ

## Important Notes

- The Sync App does NOT delete records from the target. It only adds new records and updates existing ones.
- Salmon Arm uses a different workflow: the hosted Feature Layer is overwritten entirely, then the ETL script syncs changes into the enterprise geodatabase. The Sync App is used for the other three municipalities.
- Always verify the diff results before executing. Once sync runs, changes are applied immediately to the editing layer.
- Changes applied by the Sync App will be picked up by the next nightly pipeline run (Reconcile/Post from municipal version to QA).
