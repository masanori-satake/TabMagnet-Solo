import sys
import os
import json
import re

def verify_no_external_libraries():
    passed = True
    manifest_path = "projects/app/manifest.json"
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r") as f:
                manifest = json.load(f)
                for script in manifest.get("content_scripts", []):
                    for js in script.get("js", []):
                        if re.match(r"^(?:https?:)?//", js):
                            print(f"Error: External script found in manifest.json: {js}")
                            passed = False
        except Exception as e:
            print(f"Error: {e}")
            passed = False

    external_script_src_pattern = re.compile(r'<script[^>]+src=["\']((?:https?:)?//[^"\']+)["\']', re.IGNORECASE)
    external_link_href_pattern = re.compile(r'<link[^>]+href=["\']((?:https?:)?//[^"\']+)["\']', re.IGNORECASE)

    for root, dirs, files in os.walk("."):
        if "node_modules" in dirs: dirs.remove("node_modules")
        if ".git" in dirs: dirs.remove(".git")
        for file in files:
            if file.endswith(".html"):
                file_path = os.path.join(root, file)
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    if external_script_src_pattern.search(content) or external_link_href_pattern.search(content):
                        print(f"Error: External resource found in {file_path}")
                        passed = False
    return passed

if __name__ == "__main__":
    if not verify_no_external_libraries(): sys.exit(1)
