import json
import os

schema_path = r"C:\Users\solim\Arcgis Notebooks\Web App\DownloadFiles\SSAP_Schema.json"
output_md = r"C:\Users\solim\Arcgis Notebooks\Documentation\Database_Schema_Summary.md"

with open(schema_path, "r", encoding="utf-8") as f:
    data = json.load(f)

dataset = data["datasets"][0]
fields = dataset["fields"]["fieldArray"]

md_content = f"# SDE.NG911_SiteAddress Database Schema\\n\\n"
md_content += f"The NG911 SiteAddress feature class in the central database contains a total exact count of {len(fields)} fields.\\n\\n"
md_content += "## Complete Field List\\n\\n"
md_content += "| Field Name | Type | Alias | Length | Nullable |\\n"
md_content += "|---|---|---|---|---|\\n"

for f in fields:
    name = f.get("name", "")
    ftype = f.get("type", "").replace("esriFieldType", "")
    alias = f.get("aliasName", "")
    length = f.get("length", "")
    nullable = f.get("isNullable", True)
    
    md_content += f"| `{name}` | {ftype} | {alias} | {length} | {nullable} |\\n"

with open(output_md, "w", encoding="utf-8") as out:
    out.write(md_content)

print(f"Successfully generated {output_md} with {len(fields)} fields.")
