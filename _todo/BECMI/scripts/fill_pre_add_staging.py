#!/usr/bin/env python3
from __future__ import annotations
import re
from pathlib import Path
from dataclasses import dataclass
import fitz

TEMPLATE = Path('/mnt/data/pre_add_staging_template.md')
OUTPUT = Path('/mnt/data/pre_add_staging_filled_v5.md')

@dataclass
class SourceSpec:
    title: str
    year: int
    source_url: str
    local_path: Path
    kind: str
    page_range: tuple[int, int] | None = None

SOURCES = {
    'men_magic': SourceSpec(
        title='Dungeons & Dragons, Volume 1: Men & Magic',
        year=1974,
        source_url='https://ia601204.us.archive.org/1/items/tsr02002menmagic/tsr02002%20-%20Men_%26_Magic.pdf',
        local_path=Path('/mnt/data/men_magic.pdf'),
        kind='pdf',
        page_range=(26, 27),
    ),
    'greyhawk': SourceSpec(
        title='Dungeons & Dragons Supplement I: Greyhawk',
        year=1975,
        source_url='https://ia601407.us.archive.org/19/items/greyhawk_202202/Greyhawk/Rules/tsr02003%20-%20Supplement%201%20-%20Greyhawk_djvu.txt',
        local_path=Path('/mnt/data/greyhawk.txt'),
        kind='txt',
    ),
    'holmes': SourceSpec(
        title='Dungeons & Dragons Basic Set',
        year=1977,
        source_url='https://www.americanroads.us/DandD/DnD_Basic_Rules_Holmes.pdf',
        local_path=Path('/mnt/data/holmes_basic.pdf'),
        kind='pdf',
        page_range=(15, 17),
    ),
}

BLOCK_TO_TARGET = {
    'mm-clairaudience': ('men_magic', 'Clairaudience'),
    'mm-slow': ('men_magic', 'Slow Spell'),
    'gh-darkness': ('greyhawk', "Darkness, 5' Radius"),
    'gh-strength': ('greyhawk', 'Strength'),
    'gh-magic-mouth': ('greyhawk', 'Magic Mouth'),
    'gh-pyrotechnics': ('greyhawk', 'Pyrotechnics'),
    'hb-darkness': ('holmes', 'Darkness'),
    'hb-strength': ('holmes', 'Strength'),
    'hb-magic-mouth': ('holmes', 'Magic Mouth'),
    'hb-pyrotechnics': ('holmes', 'Pyrotechnics'),
    'hb-dancing-lights': ('holmes', 'Dancing Lights'),
    'hb-enlargement': ('holmes', 'Enlargement'),
    'hb-audible-glamer': ('holmes', 'Audible Glamer'),
    'hb-ray-of-enfeeblement': ('holmes', 'Ray of Enfeeblement'),
    'hb-clairaudience': ('holmes', 'Clairaudience'),
    'odnd-esp': ('synthetic', 'ESP'),
    'odnd-clairvoyance': ('synthetic', 'Clairvoyance'),
    'odnd-clairaudience': ('synthetic', 'Clairaudience'),
}

OVERRIDES = {
    'hb-clairaudience': {
        'text': 'Clairaudience: Same as Clairvoyance except it allows hearing rather than visualization. This is one of the few spells which can be cast through a Crystal Ball (see Volume II).',
        'source_url': 'https://deltasdnd.blogspot.com/2014/07/spells-through-ages-esp-and-clairvoyance.html',
        'note': "Holmes-era wording sourced from Delta's comparative post because the Holmes scan witness used here was list-only for this block.",
    },
    'odnd-esp': {
        'text': "ESP: A spell which allows the user to detect the thoughts (if any) of whatever lurks behind doors or in the darkness. It can penetrate solid rock up to about 2' in thickness, but a thin coating of lead will prevent its penetration. Duration: 12 turns. Range: 6\"",
        'source_url': 'https://deltasdnd.blogspot.com/2014/07/spells-through-ages-esp-and-clairvoyance.html',
        'note': "OD&D-era ESP wording from Delta's comparative post, used to complete the ESP/Clairvoyance/Clairaudience trio.",
    },
    'odnd-clairvoyance': {
        'text': 'Clairvoyance: Same as ESP spell except the spell user can visualize rather than merely pick up thoughts.',
        'source_url': 'https://www.paulsgameblog.com/2011/12/17/spells-through-the-ages-clairvoyance/',
        'note': 'OD&D-era Clairvoyance wording used as the paired source reference for the Holmes-era Clairaudience cross-reference.',
    },
}

FENCE_RE = re.compile(r'```text id="(?P<id>[^"]+)"\n(?P<body>.*?)\n```', re.S)


def norm(text: str) -> str:
    text = text.replace('\r\n', '\n').replace('\r', '\n').replace('\x0c', '\n')
    text = text.replace('\u00a0', ' ')
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def read_pdf_window(path: Path, start: int, end: int) -> str:
    doc = fitz.open(path)
    parts = []
    try:
        for p in range(start - 1, end):
            txt = doc.load_page(p).get_text('text')
            parts.append(f'\n[page {p+1}]\n{txt}')
    finally:
        doc.close()
    return norm('\n'.join(parts))


def load_corpora() -> dict[str, str]:
    out = {}
    for key, spec in SOURCES.items():
        if spec.kind == 'pdf':
            out[key] = read_pdf_window(spec.local_path, *spec.page_range)
        else:
            out[key] = norm(spec.local_path.read_text(encoding='utf-8', errors='ignore'))
    return out


NEXT_HEADINGS = {
    ('men_magic', 'Clairaudience'): ['Fire Ball'],
    ('men_magic', 'Slow Spell'): ['Haste Spell'],
    ('greyhawk', "Darkness, 5' Radius"): ['Strength:'],
    ('greyhawk', 'Strength'): ['Web:'],
    ('greyhawk', 'Magic Mouth'): ['Pyrotechnics:'],
    ('greyhawk', 'Pyrotechnics'): ['3rd Level:'],
    ('holmes', 'Dancing Lights'): ['Detect Magic —'],
    ('holmes', 'Enlargement'): ['Hold Portal —'],
    ('holmes', 'Audible Glamer'): ['Continual Light —'],
    ('holmes', 'Darkness'): ['Detect Evil —'],
    ('holmes', 'Magic Mouth'): ['Mirror Image —'],
    ('holmes', 'Pyrotechnics'): ['Ray of Enfeeblement —'],
    ('holmes', 'Ray of Enfeeblement'): ['Strength —'],
    ('holmes', 'Strength'): ['Web —'],
}


def extract_between(corpus: str, start_pat: str, next_pat: str | None) -> str | None:
    m = re.search(start_pat, corpus, flags=re.M)
    if not m:
        return None
    start = m.start()
    end = len(corpus)
    if next_pat:
        n = re.search(next_pat, corpus[m.end():], flags=re.M)
        if n:
            end = m.end() + n.start()
    block = norm(corpus[start:end])
    return block if block else None


def extract_spell(book: str, target: str, corpus: str, block_id: str) -> str | None:
    if block_id in OVERRIDES:
        return OVERRIDES[block_id]['text']

    if book == 'men_magic':
        start_pat = rf'^{re.escape(target)}:.*$'
        nh = NEXT_HEADINGS.get((book, target), [None])[0]
        next_pat = rf'^{re.escape(nh)}:.*$' if nh else None
        return extract_between(corpus, start_pat, next_pat)

    if book == 'greyhawk':
        start_pat = rf'^{re.escape(target)}:.*$'
        nh = NEXT_HEADINGS.get((book, target), [None])[0]
        next_pat = rf'^{re.escape(nh)}.*$' if nh else None
        return extract_between(corpus, start_pat, next_pat)

    if book == 'holmes':
        start_pat = rf'^{re.escape(target)}\s+—.*$'
        nh = NEXT_HEADINGS.get((book, target), [None])[0]
        next_pat = rf'^{re.escape(nh)}.*$' if nh else None
        return extract_between(corpus, start_pat, next_pat)

    return None


def metadata(book: str, target: str, block_id: str) -> str:
    if book == 'synthetic':
        override = OVERRIDES[block_id]
        spell_levels = {
            'odnd-esp': '2',
            'odnd-clairvoyance': '3',
            'odnd-clairaudience': '3',
        }
        lines = [
            '[Source metadata]',
            'Title: OD&D Family comparative witness note',
            'Year: 1974',
            f'Source URL: {override["source_url"]}',
            f'Spell Level: {spell_levels[block_id]}',
            f'Target: {target}',
            f'Override note: {override["note"]}',
        ]
        return '\n'.join(lines)
    s = SOURCES[book]
    lines = [
        '[Source metadata]',
        f'Title: {s.title}',
        f'Year: {s.year}',
        f'Source URL: {s.source_url}',
        f'Target: {target}',
    ]
    if block_id in OVERRIDES:
        lines.append(f'Override URL: {OVERRIDES[block_id]["source_url"]}')
        lines.append(f'Override note: {OVERRIDES[block_id]["note"]}')
    return '\n'.join(lines)


def main() -> None:
    corpora = load_corpora()
    template = TEMPLATE.read_text(encoding='utf-8')

    def repl(m: re.Match[str]) -> str:
        block_id = m.group('id')
        if block_id not in BLOCK_TO_TARGET:
            return m.group(0)
        book, target = BLOCK_TO_TARGET[block_id]
        if book == 'synthetic':
            block = OVERRIDES[block_id]['text']
        else:
            block = extract_spell(book, target, corpora[book], block_id)
        if not block:
            return m.group(0)
        return f'```text id="{block_id}"\n{metadata(book, target, block_id)}\n\n{block}\n```'

    out = FENCE_RE.sub(repl, template)
    OUTPUT.write_text(out, encoding='utf-8')
    print(f'Wrote {OUTPUT}')


if __name__ == '__main__':
    main()
