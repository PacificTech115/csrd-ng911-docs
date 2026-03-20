# Municipal Operations Handbook

This guide covers the addressing workflow for each municipality in the CSRD NG911 system, including how to access the system, edit addresses, and sync data.

## General Workflow

All municipalities follow the same data promotion pipeline:

```
1. Municipal editor makes address edits in their version
2. Nightly pipeline reconciles edits into SDE.QA
3. QA validation runs automatically
4. Validated data promotes to sde.DEFAULT (production)
5. Export creates a timestamped File GDB snapshot
6. QAStatus syncs back to municipal editors
```

## System Access

### ArcGIS Enterprise Portal
- URL: `https://apps.csrd.bc.ca/hub`
- Used for: Map viewers, data management, ArcGIS Pro connections
- Each municipality has a dedicated editing account

### NG911 Documentation Hub
- URL: `https://apps.csrd.bc.ca/ng911`
- Used for: Documentation, schema reference, GP tools (admin), Sync App, AI assistant
- Same login credentials as the Portal

### ArcGIS Pro Connection
- Each municipality downloads a `.pitemx` project file from their municipal guide page
- The .pitemx connects to their editing version on the Enterprise geodatabase
- Edits are made in ArcGIS Pro against the versioned SDE connection

---

## Revelstoke

### Access Details
| Resource | Value |
|----------|-------|
| Editing account | `revelstoke_editing` |
| SDE Version | `SDE.Revelstoke` |
| Feature Service | `/Regional/NG911_Address_Revelstoke_Edit/FeatureServer` |
| Guide page | `#revelstoke` in Documentation Hub |

### Editing Workflow
1. Download the Revelstoke .pitemx from the Documentation Hub (`#revelstoke`)
2. Open in ArcGIS Pro -- connects to SDE.Revelstoke version
3. Start editing address points (add, move, update attributes)
4. Save edits in ArcGIS Pro
5. Edits are picked up by the nightly pipeline automatically
6. Check QAStatus after the next pipeline run for validation results

### Sync Process
Revelstoke uses the **Sync App** in the Documentation Hub:
1. Go to `#sync-app` (auto-detects Revelstoke target layer)
2. Paste source Feature Service URL
3. Run Extract & Compare to review changes
4. Execute Sync to apply inserts/updates

---

## Golden

### Access Details
| Resource | Value |
|----------|-------|
| Editing account | `golden_editing` |
| SDE Version | `SDE.Golden` |
| Feature Service | `/Regional/NG911_Address_Golden_Edit/FeatureServer` |
| Guide page | `#golden` in Documentation Hub |

### Editing Workflow
1. Download the Golden .pitemx from the Documentation Hub (`#golden`)
2. Open in ArcGIS Pro -- connects to SDE.Golden version
3. Edit address points
4. Save edits
5. Nightly pipeline processes changes automatically

### Sync Process
Golden uses the **Sync App** in the Documentation Hub:
1. Go to `#sync-app` (auto-detects Golden target layer)
2. Follow the same 3-step wizard as Revelstoke

---

## Salmon Arm

### Access Details
| Resource | Value |
|----------|-------|
| Editing account | `salmon_arm_editing` |
| SDE Version | `SDE.Salmon Arm` |
| Guide page | `#salmonarm` in Documentation Hub |

### Editing Workflow
Salmon Arm has a **different workflow** from other municipalities:
1. Salmon Arm maintains their own Hosted Feature Layer on the Portal
2. They edit addresses directly in their hosted layer
3. The **Salmon Arm ETL script** (`2.NG911-SalmonArmETL.py`) syncs changes into the enterprise geodatabase
4. ETL runs as an ArcGIS Notebook (Item ID: `fb8fd369499b440c8ae3720c1bbe3b9f`)

### Sync Process (ETL)
The ETL script handles synchronization automatically:
1. Fetches all features from Salmon Arm's hosted layer
2. Compares against the CSRD central database using cascading key match (NGUID, GlobalID, FeatureID)
3. Applies inserts, updates, and deletes in batches of 200 records
4. Pushes generated NGUID and CentralGlobalID back to the source hosted layer
5. Sends a Power Automate webhook notification on completion

The Salmon Arm ETL does NOT use the browser-based Sync App.

---

## Sicamous

### Access Details
| Resource | Value |
|----------|-------|
| Editing account | `sicamous_editing` |
| SDE Version | `SDE.Sicamous` |
| Feature Service | `/Regional/NG911_Address_Sicamous_Edit/FeatureServer` |
| Guide page | `#sicamous` in Documentation Hub |

### Editing Workflow
1. Download the Sicamous .pitemx from the Documentation Hub (`#sicamous`)
2. Open in ArcGIS Pro -- connects to SDE.Sicamous version
3. Edit address points
4. Save edits
5. Nightly pipeline processes changes automatically

### Sync Process
Sicamous uses the **Sync App** in the Documentation Hub:
1. Go to `#sync-app` (auto-detects Sicamous target layer)
2. Follow the same 3-step wizard as Revelstoke

---

## Common Troubleshooting

### "Cannot connect to version"
- Verify the .pitemx is configured for your municipality's version
- Check that the SDE connection file is accessible on the network
- Confirm your editing account has the correct permissions

### QAStatus shows errors after pipeline run
- Open the QAStatus field in ArcGIS Pro to see the specific error message
- Common issues: missing mandatory fields (Agency, DiscrpAgID, NGUID, etc.)
- Fix the flagged records and save -- they will be re-validated on the next pipeline run

### Edits not appearing in production
- Edits in your version are not immediately visible in sde.DEFAULT
- The nightly pipeline must run to promote your edits through QA to DEFAULT
- Check the Automations Dashboard (`#automations-dashboard`) for the latest pipeline status

### Sync App shows "no features found"
- Your ArcGIS token may have expired -- log out and log back in
- Verify the source Feature Service URL is correct and accessible
- Ensure the source layer has a GlobalID field for matching
