import json
import re
import os

def update_readme():
    summary_path = 'coverage/coverage-summary.json'
    readme_path = 'README.md'

    if not os.path.exists(summary_path):
        print(f"Error: {summary_path} not found.")
        return

    with open(summary_path, 'r') as f:
        summary = json.load(f)

    # Extract branch coverage (C1)
    # The structure is usually summary['total']['branches']['pct']
    branches_pct = summary.get('total', {}).get('branches', {}).get('pct', 0)

    # Determine badge color based on threshold
    if branches_pct >= 80:
        color = 'brightgreen'
    elif branches_pct >= 60:
        color = 'yellow'
    else:
        color = 'red'

    badge_url = f'https://img.shields.io/badge/coverage-{branches_pct:.0f}%25-{color}'

    # Update README.md
    if not os.path.exists(readme_path):
        print(f"Error: {readme_path} not found.")
        return

    with open(readme_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find the coverage badge
    # Example: [![Coverage](https://img.shields.io/badge/coverage-29%25-red)](.)
    pattern = r'(\[!\[Coverage\]\(https://img\.shields\.io/badge/coverage-)[^)]+(\)\]\([^)]+\))'

    # We want to update the link as well to point to the GitHub Pages URL
    # Assuming the GitHub Pages URL is https://masanori-satake.github.io/TabMagnet-Solo/coverage/lcov-report/
    # But since we'll be copying it to projects/web/coverage, it will be at /coverage/
    new_link = 'https://masanori-satake.github.io/TabMagnet-Solo/coverage/lcov-report/'

    new_badge_markdown = rf'\1{branches_pct:.0f}%25-{color}\2'

    # First update the badge image URL
    new_content = re.sub(pattern, new_badge_markdown, content)

    # Then update the link target
    # Looking for: [!\[Coverage\]\(...\)](.)
    # We need to be careful with the group 2 in the previous regex.
    # Let's do it in one go more precisely.

    full_pattern = r'\[!\[Coverage\]\(https://img\.shields\.io/badge/coverage-[^)]+\)\]\([^)]*\)'
    replacement = f'[![Coverage]({badge_url})]({new_link})'

    new_content = re.sub(full_pattern, replacement, content)

    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"Successfully updated README.md with coverage: {branches_pct:.0f}%")

if __name__ == "__main__":
    update_readme()
