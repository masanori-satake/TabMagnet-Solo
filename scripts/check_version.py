import json
import sys
import re
import os

def check_version_consistency():
    try:
        # 1. projects/app/manifest.json
        with open("projects/app/manifest.json", "r") as f:
            manifest_version = json.load(f).get("version")

        # 2. package.json
        with open("package.json", "r") as f:
            package_json = json.load(f)
            package_version = package_json.get("version")

        # 3. package-lock.json
        with open("package-lock.json", "r") as f:
            package_lock_json = json.load(f)
            lock_version = package_lock_json.get("version")
            # packages[""] のバージョンも確認
            lock_pkg_version = package_lock_json.get("packages", {}).get("", {}).get("version")

        # 4. README.md (Badge)
        with open("README.md", "r") as f:
            readme_content = f.read()
            # [![version](https://img.shields.io/badge/version-0.2.0-blue)](...)
            badge_match = re.search(r"img\.shields\.io/badge/version-([\d\.]+)-blue", readme_content)
            readme_version = badge_match.group(1) if badge_match else None

        # 5. tests/sidepanel.test.js
        test_version = None
        if os.path.exists("tests/sidepanel.test.js"):
            with open("tests/sidepanel.test.js", "r") as f:
                test_content = f.read()
                # expect(...).toBe('v1.5.2') or version: '1.5.2'
                test_match = re.search(r"version: '([\d\.]+)'", test_content)
                test_version = test_match.group(1) if test_match else None

        versions = {
            "projects/app/manifest.json": manifest_version,
            "package.json": package_version,
            "package-lock.json": lock_version,
            "package-lock.json (packages[''])": lock_pkg_version,
            "README.md (badge)": readme_version,
            "tests/sidepanel.test.js": test_version,
        }

        print("Checking version consistency:")
        for source, version in versions.items():
            print(f"  - {source}: {version}")

        if len(set(versions.values())) > 1:
            print(f"\nError: Version mismatch detected!")
            return False

        print(f"\nAll versions are consistent: {package_version}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if not check_version_consistency():
        sys.exit(1)
