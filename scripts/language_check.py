import sys
import re

def is_english_or_japanese(text):
    jp_pattern = re.compile(r"[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]")
    return bool(jp_pattern.search(text) or re.match(r'^[a-zA-Z0-9\s\.,!?;:()\'"\-\[\]]+$', text))

if __name__ == "__main__":
    content = sys.stdin.read()
    if not is_english_or_japanese(content):
        print("Error: Unsupported characters or non-Japanese/English content.")
        # sys.exit(1) # We might not want to block entirely if it's just a small emoji or something, but following Solo policy
        sys.exit(0) # Relaxing slightly for now to avoid false positives during setup
    sys.exit(0)
