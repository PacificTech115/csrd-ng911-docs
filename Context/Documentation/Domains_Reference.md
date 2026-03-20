# Domains Reference

This document lists valid coded domain values for key fields in the NG911 SiteAddress feature class.

## Agency Values

The Agency field identifies which organization is responsible for the address record.

| Agency | DiscrpAgID | Description |
|--------|-----------|-------------|
| CSRD | csrd.bc.ca | Columbia Shuswap Regional District (admin/regional) |
| Revelstoke | revelstoke.ca | City of Revelstoke |
| Golden | golden.ca | Town of Golden |
| Salmon Arm | salmonarm.ca | City of Salmon Arm |
| Sicamous | sicamous.ca | District of Sicamous |

## AddCode Municipality Mappings (47 entries)

The AddCode field is a numeric code automatically calculated from the A3 (Locality) field by the AddCode attribute rule.

| Municipality (A3) | AddCode |
|-------------------|---------|
| ANSTEY ARM | 1066 |
| BEATON | 60 |
| BLAEBERRY | 1054 |
| BLIND BAY | 581 |
| CANYON HOT SPRINGS | 1053 |
| CASTLEDALE | 18 |
| CELISTA | 594 |
| CRAIGELLACHIE | 182 |
| DEEP CREEK | 577 |
| DONALD | 180 |
| EAGLE BAY | 593 |
| FALKLAND | 586 |
| FIELD | 795 |
| GALENA BAY | 61 |
| GOLDEN | 179 |
| HEYWOODS | 587 |
| LEANCHOLI | 1056 |
| LEE CREEK | 597 |
| MAGNA BAY | 880 |
| MALAKWA | 185 |
| MICA CREEK | 183 |
| NORTH MARA | 584 |
| NOTCH HILL | 592 |
| OKANAGAN IR NORTH | 1119 |
| PARSON | 19 |
| REVELSTOKE | 181 |
| ROGERS PASS | 178 |
| SALMON ARM | 574 |
| SALMON RIVER IR | 1118 |
| SCOTCH CREEK | 598 |
| SEYMOUR ARM | 1065 |
| SICAMOUS | 583 |
| SOLSQUA | 186 |
| SORRENTO | 580 |
| SOUTH KINBASKET LAKE | 872 |
| SPALLUMCHEEN | 1075 |
| ST IVES | 595 |
| TAPPEN | 576 |
| THREE VALLEY | 555 |
| TROUT LAKE | 59 |
| WHITE LAKE | 582 |

Note: Some municipalities in the full list (47 total) may not appear above if they were not found in the Arcade source. The rule maps uppercase A3 values to their numeric codes.

## Geographic Fields

| Field | Valid Values | Description |
|-------|-------------|-------------|
| Country | `CA` | 2-character ISO country code (Canada) |
| A1 (Province) | `BC` | 2-character province code (British Columbia) |
| A2 (Regional District) | `Columbia Shuswap Regional District` | Full regional district name |
| A3 (Locality) | See AddCode table above | Municipality or community name |
| Post_Code | Canadian postal code format (e.g., `V0E 2S0`) | 7 characters with space |
| PostCodeEx | 4-character extension | Postal code extension (rarely used) |

## QAStatus Values

The QAStatus field tracks data quality workflow status. Values are set by the QAStatus attribute rule and the QA validation GP tool.

| Value | Set By | Meaning |
|-------|--------|---------|
| Pending | Attribute rule | Record is new or has been edited since last QA run |
| Passed | QA GP tool | Record passed all validation checks |
| Warning: [details] | QA GP tool | Non-blocking issues found (e.g., duplicate address) |
| [Error message] | QA GP tool | Blocking issues found (missing fields, null mandatory values, duplicate NGUID) |

## Enterprise Geodatabase Versions

| Version Name | Purpose |
|-------------|---------|
| sde.DEFAULT | Authoritative production version |
| SDE.QA | Staging and validation gate |
| SDE.CSRD | CSRD regional internal editing |
| SDE.Revelstoke | Revelstoke municipal editing |
| SDE.Golden | Golden municipal editing |
| SDE.Salmon Arm | Salmon Arm municipal editing (via ETL sync) |
| SDE.Sicamous | Sicamous municipal editing |

## Editing Account Usernames

| Username | Municipality | Role |
|----------|-------------|------|
| csrd_service | CSRD | Admin / Service account |
| csrd_gis | CSRD | Admin / GIS staff |
| dmajor@csrd | CSRD | Admin |
| revelstoke_editing | Revelstoke | Municipal editor |
| golden_editing | Golden | Municipal editor |
| salmon_arm_editing | Salmon Arm | Municipal editor |
| sicamous_editing | Sicamous | Municipal editor |
