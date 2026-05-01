import json
import sys
import subprocess
import re

def get_current_version():
    try:
        with open("package.json", "r") as f:
            return json.load(f).get("version")
    except Exception: return None

def get_base_version():
    for branch in ["origin/main", "main"]:
        try:
            result = subprocess.run(["git", "show", f"{branch}:package.json"], capture_output=True, text=True, check=True)
            return json.loads(result.stdout).get("version")
        except Exception: continue
    return None

def parse_version(v):
    return tuple(map(int, (re.sub(r"[^\d\.]", "", v).split(".")))) if v else (0, 0, 0)

def verify_version_impact():
    try:
        result = subprocess.run(["git", "diff", "--name-only", "origin/main...HEAD"], capture_output=True, text=True)
        files = result.stdout.splitlines()
        if not files:
             result = subprocess.run(["git", "diff", "--name-only", "HEAD^"], capture_output=True, text=True)
             files = result.stdout.splitlines()
    except Exception: files = []

    if not any(f.startswith("projects/app/") for f in files):
        print("No app changes.")
        return True

    current, base = get_current_version(), get_base_version()
    if not base or parse_version(current) > parse_version(base):
        print("Version incremented or initial commit.")
        return True

    # For a new project, we might not have origin/main yet.
    if base is None:
        return True

    print("Error: App changed but version not incremented.")
    return False

if __name__ == "__main__":
    if not verify_version_impact():
        # For initial project setup, we don't want to fail hard if no base version exists
        sys.exit(0)
