"""
lares_verification.py

A generalized verification tool for Lares LOCI files.
Evaluates OODA-A phase testability, E-Prime compliance, kahea resolution, registry status, and pipeline references.
Outputs a 0.0-1.0 score for each instrument and actionable operator options on failure.
"""
import re
import os
import yaml
from pathlib import Path
from typing import Dict, Any, List, Tuple

# --- Utility functions ---
def load_yaml_frontmatter(md_path: Path) -> Dict[str, Any]:
    """Extract YAML frontmatter from a markdown file."""
    with md_path.open('r', encoding='utf-8') as f:
        content = f.read()
    match = re.match(r"---\n(.*?)---\n", content, re.DOTALL)
    if match:
        return yaml.safe_load(match.group(1))
    return {}

def extract_sections(md_path: Path) -> Dict[str, str]:
    """Extract sections by heading from a markdown file."""
    sections = {}
    current = None
    buf = []
    with md_path.open('r', encoding='utf-8') as f:
        for line in f:
            if line.startswith('#'):
                if current:
                    sections[current] = ''.join(buf)
                current = line.strip('#').strip()
                buf = []
            else:
                buf.append(line)
        if current:
            sections[current] = ''.join(buf)
    return sections

def find_kahea_targets(md_path: Path) -> List[str]:
    """Find all kahea markers in a file."""
    targets = []
    with md_path.open('r', encoding='utf-8') as f:
        for line in f:
            m = re.search(r'<!-- kahea (lares://[^ ]+)', line)
            if m:
                targets.append(m.group(1))
    return targets

def check_eprime(text: str) -> float:
    """Score E-Prime compliance (fraction of sentences without 'is/are/am/was/were/be/been/being')."""
    sentences = re.split(r'[.!?]\s+', text)
    if not sentences:
        return 1.0
    non_eprime = sum(1 for s in sentences if re.search(r'\b(is|are|am|was|were|be|been|being)\b', s, re.I))
    return 1.0 - (non_eprime / len(sentences))

def check_registry(loci_path: Path, registry_path: Path) -> float:
    """Check if the LOCI file is registered in the grammar registry."""
    with registry_path.open('r', encoding='utf-8') as f:
        content = f.read()
    return 1.0 if loci_path.name in content else 0.0

def check_ooda_sections(sections: Dict[str, str]) -> float:
    """Check for presence of OODA-A phase sections."""
    # Dynamically detect all Loop Position and Handoff sections for any grammar loci
    phase_scores = []
    phase_reports = []
    for heading, content in sections.items():
        if 'loop position' in heading.lower():
            # Try to find the phase name (e.g., Observe, Orient, etc.)
            phase = heading.replace('Loop Position', '').strip() or 'Phase'
            # Check for lists
            lists = ['receives', 'changes', 'hands forward', 'should not']
            list_score = 0
            missing_lists = []
            for l in lists:
                # Accept both '-' and '*' as list markers, tolerate whitespace
                if re.search(rf'{l}\s*:\s*\n([\-\*])', content, re.I):
                    list_score += 1
                else:
                    missing_lists.append(l)
            list_score /= len(lists)
            # Find matching handoff section
            handoff_score = 0
            handoff_found = 0
            handoff_content = ''
            for h2, c2 in sections.items():
                if 'handoff' in h2.lower() and phase.lower() in h2.lower():
                    handoff_content = c2
                    break
            if not handoff_content:
                # Try to find a generic handoff section
                for h2, c2 in sections.items():
                    if 'handoff' in h2.lower():
                        handoff_content = c2
                        break
            # Score handoff by number of questions (lines starting with a number or '-')
            questions = re.findall(r'(^\s*\d+\.\s+.+|^-\s+.+)', handoff_content, re.MULTILINE)
            handoff_score = min(len(questions), 4) / 4 if questions else 0
            phase_score = 0.7 * list_score + 0.3 * handoff_score
            phase_scores.append(phase_score)
            report = f"{phase}: {phase_score:.2f}"
            if missing_lists:
                report += f" | Missing lists: {', '.join(missing_lists)}"
            if handoff_score < 1.0:
                report += f" | Handoff questions: {len(questions) if questions else 0}/4"
            phase_reports.append(report)
    # Print detailed report
    print("\nOODA-A Phase Details:")
    for r in phase_reports:
        print("  ", r)
    return sum(phase_scores) / len(phase_scores) if phase_scores else 0.0

def check_kahea_resolution(targets: List[str], loci_dir: Path) -> float:
    """Check if kahea targets resolve to existing files."""
    if not targets:
        return 1.0
    resolved = 0
    for t in targets:
        # crude: treat lares:///foo/bar as foo/bar/LOCI.md
        parts = t.replace('lares:///', '').split('/')
        guess = loci_dir.parent / '/'.join(parts) / 'LOCI.md'
        if guess.exists():
            resolved += 1
    return resolved / len(targets)

# --- Main verification ---
def verify_loci(loci_path: str, registry_path: str) -> Dict[str, Any]:
    loci = Path(loci_path)
    registry = Path(registry_path)
    sections = extract_sections(loci)
    text = loci.read_text(encoding='utf-8')
    kahea_targets = find_kahea_targets(loci)
    results = {}
    results['ooda_phases'] = check_ooda_sections(sections)
    results['eprime'] = check_eprime(text)
    results['kahea_resolution'] = check_kahea_resolution(kahea_targets, loci.parent)
    results['registry'] = check_registry(loci, registry)
    return results

# --- Operator options ---
def operator_report(results: Dict[str, float], threshold: float = 0.95) -> None:
    print("\nVerification Results:")
    for k, v in results.items():
        status = 'PASS' if v >= threshold else ('WARN' if v >= 0.7 else 'FAIL')
        print(f"{k:20}: {v:.2f} [{status}]")
    print("\nOperator Options:")
    for k, v in results.items():
        if v < threshold:
            if k == 'ooda_phases':
                print("- Add or clarify OODA-A phase sections for testability.")
            elif k == 'eprime':
                print("- Rewrite operational language to conform to E-Prime discipline.")
            elif k == 'kahea_resolution':
                print("- Resolve or remove broken kahea summons.")
            elif k == 'registry':
                print("- Register or assert the true name for this LOCI in grammar/LOCI.md (true-name registry).")

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Verify a Lares LOCI file for operational compliance. The registry is the true-name registry (grammar/LOCI.md).')
    parser.add_argument('loci', help='Path to LOCI.md file')
    parser.add_argument('--registry', default='../../grammar/LOCI.md', help='Path to grammar registry')
    parser.add_argument('--threshold', type=float, default=0.95, help='Pass threshold (default 0.95)')
    args = parser.parse_args()
    results = verify_loci(args.loci, args.registry)
    operator_report(results, args.threshold)
