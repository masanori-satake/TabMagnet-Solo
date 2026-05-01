import json
import sys
import re

def check_version_consistency():
    try:
        with open("projects/app/manifest.json", "r") as f:
            manifest_version = json.load(f).get("version")
        with open("package.json", "r") as f:
            package_version = json.load(f).get("version")

        # TabMagnet-Solo's README might not have the badge yet, but we check if version is mentioned
        with open("README.md", "r") as f:
            readme_content = f.read()
            # If there's a version badge or similar, check it.
            # For now, we assume consistency if package and manifest match.

        versions = {
            "manifest.json": manifest_version,
            "package.json": package_version,
        }

        if len(set(versions.values())) > 1:
            print(f"Version mismatch: {versions}")
            return False
        print(f"Versions consistent: {package_version}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if not check_version_consistency(): sys.exit(1)
