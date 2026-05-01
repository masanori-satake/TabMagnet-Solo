import json
import sys

def audit_dependencies():
    try:
        with open("package.json", "r") as f:
            if json.load(f).get("dependencies"):
                print("Error: Production dependencies found.")
                return False
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if not audit_dependencies(): sys.exit(1)
