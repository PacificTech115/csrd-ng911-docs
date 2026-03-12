# NG911 System Dependencies Reference

All ArcGIS Portal items, REST endpoints, server paths, and SDE connections
for the CSRD NG911 Central Database system.

Portal Base URL: https://apps.csrd.bc.ca/hub/home/item.html?id=
ArcGIS Server Base: https://apps.csrd.bc.ca/arcgis/rest/services/

---

## SDE Connection File

- sde@regional.sde → \\GIS\Scripts\NG911\NG911_Automation\connections\sde@regional.sde

## Schema File

- SSAP_Schema.json → \\GIS\Scripts\NG911\NG911_Automation\SSAP_Schema.json

## GP Toolbox & Exports

- SSAP_Automation.atbx → \\GIS\Scripts\NG911\NG911_Automation\GPTools\SSAP_Automation.atbx
- SSAP_Automation.Tool.pyt.xml → \\GIS\Scripts\NG911\NG911_Automation\GPTools\SSAP_Automation.Tool.pyt.xml
- NG911 Exports Directory → \\GIS\Scripts\Geoshare\NG911 Exports\
- NG911_Services Project Folder → \\GIS\Scripts\NG911\NG911_Services\

---

## ArcGIS Notebooks

| Name | Portal ID |
|---|---|
| 1.NG911-Reconcile Municipal-QA-Reconcile Default | 811614c266a84b769c1fe9ffbedda058 |
| 2.NG911-SalmonArmETL | fb8fd369499b440c8ae3720c1bbe3b9f |

## Geoprocessing Services (GIS Server)

| Name | Portal ID | REST Endpoint |
|---|---|---|
| QA | 0aef1fe4cdd94edea1488f52cabca7a0 | Regional/QA/GPServer |
| ReconcilePostTraditional | 1dc08bdc6d374b93be6168e21b90e360 | ReconcilePostTraditional/GPServer |
| ExportSSAP | 37426bc853a94bb4bf132d458a2736f1 | Landbase/ExportSSAP/GPServer |

## Feature Services

| Name | Portal ID | REST Endpoint |
|---|---|---|
| NG911_Address_CSRD_Edit | ac034ec5671c4adcb637f174ebba5b9f | Regional/NG911_Address_CSRD_Edit/FeatureServer |
| NG911_Address_Default | 70cd94cb1dda42779185603e8551bf19 | Regional/NG911_Address_Default/FeatureServer |
| NG911_Address_Golden_Edit | 5bc18cd5614f413a8aea25e57d55873a | Regional/NG911_Address_Golden_Edit/FeatureServer |
| NG911_Address_QA | 6365d095eb6b4971809766ebbf553aa3 | Regional/NG911_Address_QA/FeatureServer |
| NG911_Address_Revelstoke_Edit | f0c4a2487440451d81a7e1a8bf04b81e | Regional/NG911_Address_Revelstoke_Edit/FeatureServer |
| NG911_Address_SalmonArm_Edit | aa1e950efc324d809ad4e6d005706a3e | Regional/NG911_Address_SalmonArm_Edit/FeatureServer |
| NG911_Address_Sicamous_Edit | f820d1ba962846d1bd71fa0d3c975043 | Regional/NG911_Address_Sicamous_Edit/FeatureServer |
| SalmonArmOverwrite (Hosted) | 8cf1681215c540878625fdb4ec7434e4 | Hosted/SalmonArmOverwrite/FeatureServer |

## Map Services

| Name | Portal ID | REST Endpoint |
|---|---|---|
| NG911_Address_CSRD_Edit | 0a5871cd68a544fb9dcbf86b6824ddf0 | Regional/NG911_Address_CSRD_Edit/MapServer |
| NG911_Address_Default | 7a42f650520b443fb5b59be1fc75a498 | Regional/NG911_Address_Default/MapServer |
| NG911_Address_Golden_Edit | fd049108c03e479c84ab82486c8379c7 | Regional/NG911_Address_Golden_Edit/MapServer |
| NG911_Address_QA | 12c0deda0c86498e9b40aad7d4d9205e | Regional/NG911_Address_QA/MapServer |
| NG911_Address_Revelstoke_Edit | 95781e75dda5467984e001fe826c4877 | Regional/NG911_Address_Revelstoke_Edit/MapServer |
| NG911_Address_SalmonArm_Edit | f8cf56a763694a0e953c1ec683ac3de8 | Regional/NG911_Address_SalmonArm_Edit/MapServer |
| NG911_Address_Sicamous_Edit | 3d151a2d16a244cab96c4a537318e3a9 | Regional/NG911_Address_Sicamous_Edit/MapServer |

## Web Applications & Hub

| Name | Type | Portal ID |
|---|---|---|
| NG911 Address All Layers Webmap | Web Map | 362946dc6cb44c7799eb5c7e8e12245d |
| NG911 Central Database Hub | Site Application | 44c477263cfb44eaa8ad12cd95ad730b |
| NG911_Address_Sicamous_Edit_Map | Web Map | 890149d9bea34aa68eeeecfdabb1d93c |
| Power Automate | Application | 9bb635670fd7495ab9f33048c82f6363 |
| Salmon Arm Site Page | Site Page | da177402031d45febe096da55479cb61 |
| Sicamous Address Management | Web Experience | 2a6307820c874d9bbfd7289a694408d4 |

## File Geodatabase

| Name | Portal ID |
|---|---|
| SalmonArmOverwrite | c8a8b93e02584bfab35e2d29f760e245 |

## Data Stores (ArcGIS Relational)

| Name | Portal ID |
|---|---|
| Regional_CSRD | b39f659e42d240cfb1a8beb52c137f43 |
| Regional_Default | 510c2962db414b18b33a0e04cb53ca3e |
| Regional_Golden | 57a426323e9e4813b10b2d32c306a0bf |
| Regional_QA | e722f43bb27f4f9eb5985bf24781509e |
| Regional_Revelstoke | 685ab790745d4b1ab21e6d717e4b4db4 |
| Regional_SalmonArm | 994c45e8f3f748cf842df15405c0de5b |
| Regional_Sicamous | 99199772b9534b1189d512eba1936abf |
