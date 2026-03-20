# Attribute Rules Reference

The NG911 SiteAddress feature class has 10 Arcade attribute rules that automatically calculate field values, enforce data quality, and manage workflow status. These rules fire on the ArcGIS Enterprise geodatabase whenever records are inserted or updated.

## Rules Summary

| # | Rule Name | Affected Field(s) | Trigger | Status |
|---|-----------|-------------------|---------|--------|
| 1 | Full Address | Full_Addr | Insert/Update | Active |
| 2 | NGUID | NGUID | Insert | Active |
| 3 | Longitude | Longitude | Geometry change | Active |
| 4 | Latitude | Latitude | Geometry change | Active |
| 5 | AddCode | AddCode | A3 change | Active |
| 6 | DateUpdate | DateUpdate | Every edit | Active |
| 7 | QAStatus | QAStatus | Insert/Field change | Active |
| 8 | Default Agency | Agency, A3, DiscrpAgID | Insert only | INACTIVE |
| 9 | Full Street | Full_Street | Insert/Update | Active |
| 10 | Mandatory Fields | (constraint) | Insert/Update | Active |

## Detailed Rule Descriptions

### 1. Full Address (Full_Addr)

**What it does:** Automatically builds a complete mailing-style address from individual component fields.

**Concatenation order:**
Unit + Address Number (with prefix/suffix) + Street Name parts (NENA SSAP order) + Municipality + Province + Postal Code

**Component fields used:** Unit, Add_Number, AddNum_Pre, AddNum_Suf, St_PreMod, St_PreDir, St_PreTyp, St_Name, St_PosTyp, St_PosDir, St_PosMod, A3 (locality), A1 (province), Post_Code

**Example output:** `Unit 5 1234 TRANS CANADA HWY E, REVELSTOKE, BC V0E 2S0`

**Notes:** Trims whitespace, handles missing components gracefully (skips blank fields).

### 2. NGUID (NENA Globally Unique ID)

**What it does:** Generates a globally unique identifier for the address record following the NENA SSAP standard.

**Format:** `urn:emergency:uid:gis:SSAP:[GlobalID or FeatureID]:[DiscrpAgID]`

**Example output:** `urn:emergency:uid:gis:SSAP:{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}:csrd.bc.ca`

**When it fires:** Only on insert, and only when DiscrpAgID (Discrepancy Agency ID) is populated.

**Notes:** Uses GlobalID as the unique component. If GlobalID is unavailable, falls back to FeatureID.

### 3. Longitude

**What it does:** Converts the point geometry from UTM Zone 11N (NAD83) to WGS84 decimal degrees longitude.

**Input:** Feature geometry X coordinate (UTM Easting in meters)

**Output:** Decimal degrees longitude (e.g., -118.1957)

**Math:** Full UTM-to-geographic coordinate transformation using GRS80 ellipsoid (NAD83) constants for the Northern Hemisphere.

**When it fires:** On insert or when the geometry changes (point is moved).

### 4. Latitude

**What it does:** Converts the point geometry from UTM Zone 11N (NAD83) to WGS84 decimal degrees latitude.

**Input:** Feature geometry Y coordinate (UTM Northing in meters)

**Output:** Decimal degrees latitude (e.g., 50.9981)

**Math:** Companion to the Longitude rule, using the same UTM transformation with GRS80 constants.

**When it fires:** On insert or when the geometry changes (point is moved).

### 5. AddCode (Additional Code)

**What it does:** Maps the municipality name (from the A3/Locality field) to a numeric SSAP Additional Code.

**How it works:** A lookup table of 47 municipalities in the CSRD region, each mapped to their BC addressing code.

**Key mappings:**
| Municipality | Code |
|-------------|------|
| Salmon Arm | 574 |
| Revelstoke | 181 |
| Golden | 179 |
| Sicamous | 583 |
| Tappen | 576 |
| Blind Bay | 581 |
| Sorrento | 580 |
| Eagle Bay | 593 |

**When it fires:** When the A3 (Locality) field is populated or changed.

**Full list:** 47 municipalities mapped -- see `Domains_Reference.md` for the complete table.

### 6. DateUpdate

**What it does:** Automatically sets the DateUpdate field to the current timestamp whenever the record is edited.

**Value:** Uses the ArcGIS system field `last_edited_date`.

**When it fires:** On every insert or update.

### 7. QAStatus

**What it does:** Manages the data quality workflow status for each address record.

**Behavior:**
- On INSERT: Sets QAStatus to "Pending"
- On UPDATE: If any of the watched fields change and status is not already "Pending", resets to "Pending"
- Preserves explicitly set QAStatus values (e.g., when the QA tool writes "Passed" or an error message)

**Watched fields:** DiscrpAgID, NGUID, Country, A1, A2, A3, Full_Addr

**Status flow:** Pending (new/edited) --> QA tool runs --> Passed / Warning / Error message

### 8. Default Agency (INACTIVE)

**What it does:** Auto-populates the Agency, A3 (Locality), and DiscrpAgID fields based on the logged-in editing username.

**Username mappings:**
| Username | Agency | A3 | DiscrpAgID |
|----------|--------|-----|-----------|
| golden_editing | Golden | Golden | golden.ca |
| salmon_arm_editing | Salmon Arm | Salmon Arm | salmonarm.ca |
| revelstoke_editing | Revelstoke | Revelstoke | revelstoke.ca |
| sicamous_editing | Sicamous | Sicamous | sicamous.ca |
| (default) | CSRD | CSRD | csrd.bc.ca |

**When it fires:** On INSERT only.

**Status:** Currently INACTIVE (disabled). When active, it streamlines data entry by pre-filling agency fields.

### 9. Full Street (Full_Street)

**What it does:** Concatenates all street name components in the standard NENA SSAP sequence.

**Concatenation order:** St_PreMod + St_PreDir + St_PreTyp + St_Name + St_PosTyp + St_PosDir + St_PosMod

**Example output:** `TRANS CANADA HWY E`

**When it fires:** On insert or update of any street component field.

### 10. Mandatory Fields (Constraint Rule)

**What it does:** Prevents saving a record if any of the required fields are blank or null. This is a constraint rule (not a calculation rule) -- it blocks the operation rather than calculating a value.

**Required fields:** Full_Addr, Agency, DiscrpAgID, NGUID, Country, A1, A2, A3

**Behavior:**
- On INSERT or UPDATE: Checks all 8 mandatory fields
- If any are blank: Returns an error message listing the missing fields
- On DELETE: Always allows (no mandatory check needed)

**Error example:** `Missing mandatory fields: Agency, DiscrpAgID`
