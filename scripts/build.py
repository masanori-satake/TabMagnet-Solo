import json
import zipfile
import os

def build_extension():
    try:
        with open("package.json", "r", encoding="utf-8") as f:
            version = json.load(f).get("version")
        release_dir = "releases"
        if not os.path.exists(release_dir): os.makedirs(release_dir)
        zip_filename = os.path.join(release_dir, f"tabmagnet-solo-v{version}.zip")
        app_dir = os.path.join("projects", "app")

        with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(app_dir):
                for file in files:
                    if file.startswith("."): continue
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, app_dir)
                    zipf.write(file_path, arcname)
        print(f"Built {zip_filename}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    if not build_extension(): exit(1)
