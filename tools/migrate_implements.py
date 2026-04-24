#!/usr/bin/env python3
"""
Migrate `implements = [...]` TOML lists to inline pranala edges.

For each file:
1. Remove `implements = [...]` TOML block from the #iam section.
2. Find or create an `#edges` ahu section.
3. Insert `<<~ pranala #implements-X ? -> URI family:control role:implements >>` lines,
   avoiding duplicates.
4. Write back if changed.
"""

import re
import sys
from pathlib import Path

ROOT = Path("/home/joshu/Synthetic-Dream-Machine/lares/ha-ka-ba")

# Match implements = [ ... ] in TOML (may be multiline)
IMPLEMENTS_RE = re.compile(
    r'\nimplements\s*=\s*\[([^\]]*)\]\n',
    re.DOTALL,
)

# Extract URIs from the implements list value
URI_RE = re.compile(r'"(lar://[^"]+)"')

# Match the #edges ahu block (captures content inside)
EDGES_BLOCK_RE = re.compile(
    r'(<<~ ahu #edges >>.*?)(<<~/ahu >>)',
    re.DOTALL,
)

# The final sigil line
FINAL_SIGIL_RE = re.compile(r'(<<~&#x0004;[^\n]*\n?)$', re.MULTILINE)

def uri_to_frag(uri: str) -> str:
    """Convert lar:///ha.ka.ba/api/v0.1/pono/meme -> implements-meme"""
    slug = uri.rstrip('/').split('/')[-1]
    return f"implements-{slug}"

def make_pranala_line(uri: str) -> str:
    frag = uri_to_frag(uri)
    return f"<<~ pranala #{frag} ? -> {uri} family:control role:implements >>"

def migrate_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    # Find implements = [...] and extract URIs
    m = IMPLEMENTS_RE.search(text)
    if not m:
        return False

    uris = URI_RE.findall(m.group(1))
    if not uris:
        # Empty list — just remove it
        text = IMPLEMENTS_RE.sub('\n', text)
        if text != original:
            path.write_text(text, encoding="utf-8")
        return text != original

    # Remove the implements list from TOML
    text = IMPLEMENTS_RE.sub('\n', text)

    # Build pranala lines (only the ones not already present)
    new_lines = []
    for uri in uris:
        line = make_pranala_line(uri)
        if line not in text:
            new_lines.append(line)

    if not new_lines:
        if text != original:
            path.write_text(text, encoding="utf-8")
        return text != original

    # Try to insert into existing #edges block
    edges_m = EDGES_BLOCK_RE.search(text)
    if edges_m:
        insert_block = edges_m.group(1) + "\n".join(new_lines) + "\n" + edges_m.group(2)
        text = text[:edges_m.start()] + insert_block + text[edges_m.end():]
    else:
        # Create a new #edges section before the final sigil
        edges_section = (
            "\n<<~ ahu #edges >>\n\n"
            + "\n".join(new_lines)
            + "\n\n<<~/ahu >>\n\n"
        )
        final_m = FINAL_SIGIL_RE.search(text)
        if final_m:
            text = text[:final_m.start()] + edges_section + text[final_m.start():]
        else:
            text = text + edges_section

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False

def main():
    files = list(ROOT.rglob("*.md"))
    changed = 0
    skipped = 0
    for f in sorted(files):
        try:
            if migrate_file(f):
                changed += 1
                print(f"  CHANGED: {f.relative_to(ROOT.parent.parent)}")
        except Exception as e:
            print(f"  ERROR: {f} — {e}", file=sys.stderr)
            skipped += 1
    print(f"\nDone. {changed} files changed, {skipped} errors.")

if __name__ == "__main__":
    main()
