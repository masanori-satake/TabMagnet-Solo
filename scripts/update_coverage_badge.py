import json
import re
import os
import sys

def update_readme():
    summary_path = 'coverage/coverage-summary.json'
    readme_path = 'README.md'

    if not os.path.exists(summary_path):
        print(f"Error: {summary_path} not found.")
        sys.exit(1)

    with open(summary_path, 'r') as f:
        summary = json.load(f)

    # Extract branch coverage (C1)
    branches_pct = summary.get('total', {}).get('branches', {}).get('pct', 0)

    # Determine badge color based on threshold
    if branches_pct >= 80:
        color = 'brightgreen'
    elif branches_pct >= 60:
        color = 'yellow'
    else:
        color = 'red'

    badge_url = f'https://img.shields.io/badge/coverage-{branches_pct:.0f}%25-{color}'
    new_link = 'https://masanori-satake.github.io/TabMagnet-Solo/coverage/'

    # Update README.md
    if not os.path.exists(readme_path):
        print(f"Error: {readme_path} not found.")
        sys.exit(1)

    with open(readme_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find the coverage badge and its link in a single pass
    # Example: [![Coverage](https://img.shields.io/badge/coverage-29%25-red)](.)
    full_pattern = r'\[!\[Coverage\]\(https://img\.shields\.io/badge/coverage-[^)]+\)\]\([^)]*\)'
    replacement = f'[![Coverage]({badge_url})]({new_link})'

    if not re.search(full_pattern, content):
        print("Error: Coverage badge pattern not found in README.md")
        sys.exit(1)

    new_content = re.sub(full_pattern, replacement, content)

    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"Successfully updated README.md with coverage: {branches_pct:.0f}%")

if __name__ == "__main__":
    update_readme()
