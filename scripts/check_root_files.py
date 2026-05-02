import os
import sys

ALLOWED_FILES = {
    "LICENSE",
    "AGENTS.md",
    "package.json",
    "package-lock.json",
    ".gitignore",
    "README.md",
    "SECURITY.md",
    ".markdownlint.json",
    "jest.config.js",
    "playwright.config.js",
}

ALLOWED_DIRS = {
    "docs",
    "projects",
    "scripts",
    ".github",
    "releases",
    "node_modules",
    ".git",
    "tests",
}


def check_directory_cleanliness(path, allowed_files, allowed_dirs):
    if not os.path.exists(path):
        return True
    try:
        items = os.listdir(path)
    except Exception as e:
        print(f"Error listing directory {path}: {e}")
        return False

    unexpected_items = []
    for item in items:
        if item.endswith(".log") or item == ".DS_Store":
            unexpected_items.append(os.path.join(path, item))
            continue
        if item in allowed_files or item in allowed_dirs:
            continue
        unexpected_items.append(os.path.join(path, item))

    if unexpected_items:
        print(f"Error: Unexpected items found in {path}: {unexpected_items}")
        return False
    return True


def check_project_cleanliness():
    root_success = check_directory_cleanliness(
        ".",
        ALLOWED_FILES | {".pre-commit-config.yaml", ".pre-commit-ci.yaml"},
        ALLOWED_DIRS,
    )

    app_dir = os.path.join("projects", "app")
    app_allowed_files = {
        "manifest.json",
        "background.js",
        "sidepanel.html",
        "sidepanel.js",
        "LICENSE",
    }
    app_allowed_dirs = {"icons", "ui", "assets", "_locales"}
    app_success = check_directory_cleanliness(
        app_dir, app_allowed_files, app_allowed_dirs
    )

    if not root_success or not app_success:
        print("\nCleanliness check failed.")
        return False

    print("Project cleanliness check passed.")
    return True


if __name__ == "__main__":
    if not check_project_cleanliness():
        sys.exit(1)
