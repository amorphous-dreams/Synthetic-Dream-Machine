# ∞ → lares:///grammar.verification.defines/lares_verification/
"""
lares_verification.py

A generalized verification tool for Lares LOCI files.
Evaluates OODA-A phase testability, E-Prime compliance, kahea resolution, registry status, and pipeline references.
Outputs a 0.0-1.0 score for each instrument and actionable operator options on failure.
"""
import re
import os
import yaml
import subprocess
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
    # Canonical registry is truename/LOCI.md
    truename_registry = registry_path.parent / 'truename' / 'LOCI.md'
    # If this is the truename registry, always pass
    if loci_path.resolve() == truename_registry.resolve():
        return 1.0
    # Otherwise, check if this file is referenced in truename/LOCI.md or has a pointer/sidecar
    try:
        with truename_registry.open('r', encoding='utf-8') as f:
            content = f.read()
        if loci_path.name in content or str(loci_path.relative_to(registry_path.parent)) in content:
            return 1.0
        # Check for sidecar pointer file
        pointer = loci_path.parent / (loci_path.stem + '.pointer')
        if pointer.exists():
            with pointer.open('r', encoding='utf-8') as pf:
                if 'lares:///' in pf.read():
                    return 1.0
    except Exception:
        pass
    return 0.0

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

# Canonical marker patterns
# ahu:   <!-- ahu lares:///ha.ka.ba[/path][?params][#fragment] -->
# kahea: <!-- kahea lares:///ha.ka.ba[/path][?params][#fragment] -->
_AHU_MARKER    = re.compile(r'<!--\s*ahu\s+(lares:///\S+?)\s*-->')
_KAHEA_MARKER  = re.compile(r'<!--\s*kahea\s+(lares:///\S+?)\s*-->')
_HAKABA_PATH   = re.compile(
    r'^lares:///[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]'  # ha.ka.ba
    r'[^?#\s]*'                                                        # optional subpath
    r'(?:\?[^#\s]*)?'                                                  # optional query
    r'(?:#[a-zA-Z0-9_\-]+)?$'                                         # optional plain fragment
)


def _validate_marker_uris(text: str, pattern: re.Pattern) -> Tuple[int, int, List[str]]:
    """Return (total, valid, list-of-bad-uris) for all markers matching pattern."""
    total, valid, bad = 0, 0, []
    for m in pattern.finditer(text):
        uri = m.group(1)
        total += 1
        if _HAKABA_PATH.match(uri):
            valid += 1
        else:
            bad.append(uri)
    return total, valid, bad


def check_ahu_syntax(text: str) -> Tuple[float, List[str]]:
    """
    Validate <!-- ahu lares:///... --> marker syntax.
    Each ahu URI must have a canonical ha.ka.ba path.
    Fragment must be a plain section name (not chronometer form — ahu is a bookmark).
    Returns (score 0.0-1.0, list of bad URIs).
    """
    total, valid, bad = _validate_marker_uris(text, _AHU_MARKER)
    if total == 0:
        return 1.0, []  # no ahu markers = not applicable
    return valid / total, bad


def check_kahea_syntax(text: str) -> Tuple[float, List[str]]:
    """
    Validate <!-- kahea lares:///... --> transclusion marker syntax.
    Each kahea URI must have a canonical ha.ka.ba path.
    Fragment is optional (whole-locus pull is valid).
    Returns (score 0.0-1.0, list of bad URIs).
    """
    total, valid, bad = _validate_marker_uris(text, _KAHEA_MARKER)
    if total == 0:
        return 1.0, []  # no kahea markers = not applicable
    return valid / total, bad


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
def verify_loci(loci_path: str, registry_path: str) -> Tuple[Dict[str, Any], Dict[str, str]]:
    # --- Detect-alignment compliance check ---
    # Call detect_alignment.py as a subprocess and parse result
    detect_alignment_path = Path(__file__).parent.parent / 'detect-alignment' / 'detect_alignment.py'
    try:
        result = subprocess.run(['python3', str(detect_alignment_path), str(loci_path.parent)], capture_output=True, text=True)
        if '[PASS]' in result.stdout:
            detect_alignment_score = 1.0
        else:
            detect_alignment_score = 0.0
    except Exception as e:
        detect_alignment_score = 0.0

    def check_actionable_examples(sections, text):
        patterns = [r'example', r'story', r'case', r'scenario']
        for heading, content in sections.items():
            if any(re.search(p, heading, re.IGNORECASE) or re.search(p, content, re.IGNORECASE) for p in patterns):
                return 1.0
        if any(re.search(p, text, re.IGNORECASE) for p in patterns):
            return 1.0
        return 0.0

    def check_meta_reflection(sections, text):
        patterns = [r'evolution', r'adapt', r'meta', r'reflect']
        for heading, content in sections.items():
            if any(re.search(p, heading, re.IGNORECASE) or re.search(p, content, re.IGNORECASE) for p in patterns):
                return 1.0
        if any(re.search(p, text, re.IGNORECASE) for p in patterns):
            return 1.0
        return 0.0

    def check_ai_agent_guidance(sections, text):
        patterns = [r'ai agent', r'agentic', r'automate', r'automated']
        for heading, content in sections.items():
            if any(re.search(p, heading, re.IGNORECASE) or re.search(p, content, re.IGNORECASE) for p in patterns):
                return 1.0
        if any(re.search(p, text, re.IGNORECASE) for p in patterns):
            return 1.0
        return 0.0

    def check_tension_texture(sections, text):
        tension_patterns = [r'tension', r'ambiguity', r'drift']
        texture_patterns = [r'operator texture', r'feels like', r'story', r'example']
        tension = any(re.search(p, text, re.IGNORECASE) for p in tension_patterns)
        texture = any(re.search(p, text, re.IGNORECASE) for p in texture_patterns)
        return 1.0 if tension and texture else 0.5 if tension or texture else 0.0

    def check_handoff_integrity(sections):
        phases = ['Observe', 'Orient', 'Decide', 'Act', 'Assess']
        score = 0
        for i, phase in enumerate(phases):
            handoff_heading = None
            for h in sections:
                if phase.lower() in h.lower() and 'handoff' in h.lower():
                    handoff_heading = h
                    break
            if handoff_heading:
                content = sections[handoff_heading]
                prev_ok = i == 0 or phases[i-1].lower() in content.lower()
                next_ok = i == len(phases)-1 or phases[i+1].lower() in content.lower()
                if prev_ok and next_ok:
                    score += 1
        return score / len(phases)

    def check_antipatterns(sections):
        phases = ['Observe', 'Orient', 'Decide', 'Act', 'Assess']
        found = 0
        for phase in phases:
            for h, c in sections.items():
                if phase.lower() in h.lower() and 'should not' in c.lower():
                    found += 1
                    break
        return found / len(phases)

    loci = Path(loci_path)
    registry = Path(registry_path)
    sections = extract_sections(loci)
    text = loci.read_text(encoding='utf-8')
    kahea_targets = find_kahea_targets(loci)
    results = {}
    results_detail = {}
    results['ooda_phases'] = check_ooda_sections(sections)
    results['eprime'] = check_eprime(text)
    results['kahea_resolution'] = check_kahea_resolution(kahea_targets, loci.parent)
    results['registry'] = check_registry(loci, registry)
    ahu_score, ahu_bad = check_ahu_syntax(text)
    results['ahu_syntax'] = ahu_score
    results_detail['ahu_syntax'] = (
        '[PASS] All ahu markers have canonical ha.ka.ba URIs' if ahu_score == 1.0
        else f'[FAIL] {len(ahu_bad)} ahu marker(s) with malformed URI: {ahu_bad}'
    )
    kahea_score, kahea_bad = check_kahea_syntax(text)
    results['kahea_syntax'] = kahea_score
    results_detail['kahea_syntax'] = (
        '[PASS] All kahea markers have canonical ha.ka.ba URIs' if kahea_score == 1.0
        else f'[FAIL] {len(kahea_bad)} kahea marker(s) with malformed URI: {kahea_bad}'
    )
    # Run new checks
    results['example'] = check_actionable_examples(sections, text)
    results['meta_reflection'] = check_meta_reflection(sections, text)
    results['ai_agent'] = check_ai_agent_guidance(sections, text)
    results['tension_texture'] = check_tension_texture(sections, text)
    results['handoff_integrity'] = check_handoff_integrity(sections)
    results['antipatterns'] = check_antipatterns(sections)
    results['detect_alignment'] = detect_alignment_score
    # --- Sub-loop pattern: Nested OODA-A Loops ---
    # Look for explicit reference to parent/child OODA-A loops and entry/exit conditions
    nested_score = 0.0
    nested_refs = re.findall(r'(nested OODA-A|parent loop|child loop|entry condition|exit condition)', text, re.I)
    if nested_refs:
        nested_score = 1.0
    results['nested_ooda'] = nested_score
    results_detail['nested_ooda'] = f"{'[PASS]' if nested_score == 1.0 else '[FAIL]'} Nested OODA-A loop pattern"
    # 2. Fast-path/short-circuit pattern
    # --- Fast-path/short-circuit pattern (Best Practices) ---
    # Section-aware scan with full-text fallback, fuzzy matching, multiple pattern variants, precise feedback
    fast_path_score = 0.0
    fast_path_found = False
    fast_path_section = None
    # Accept multiple pattern variants
    fast_path_patterns = [r'fast[- ]?path', r'short[- ]?circuit', r'shortcut', r'bypass']
    logic_patterns = [r'criteria', r'condition', r'trigger', r'bypass', r'skip', r'immediate']
    # Section-aware scan
    for heading, content in sections.items():
        if any(re.search(p, heading, re.IGNORECASE) or re.search(p, content, re.IGNORECASE) for p in fast_path_patterns):
            fast_path_found = True
            fast_path_section = content
            break
    # Fallback: full-text scan if not found in sections
    if not fast_path_found:
        for p in fast_path_patterns:
            if re.search(p, text, re.IGNORECASE):
                fast_path_found = True
                fast_path_section = text
                break
    # Fuzzy logic: look for any logic pattern
    logic_found = False
    if fast_path_found:
        for lp in logic_patterns:
            if re.search(lp, fast_path_section, re.IGNORECASE):
                logic_found = True
                break
        if logic_found:
            fast_path_score = 1.0
        else:
            fast_path_score = 0.5
    results['fast_path'] = fast_path_score
    if not fast_path_found:
        results_detail['fast_path'] = '[FAIL] Fast-path/short-circuit pattern not found (checked section headings, content, and full text)'
    elif not logic_found:
        results_detail['fast_path'] = '[WARN] Fast-path/short-circuit section found, but no explicit criteria/condition/trigger/bypass/skip/immediate logic detected'
    else:
        results_detail['fast_path'] = '[PASS] Fast-path/short-circuit pattern and logic found'
    return results, results_detail

# --- Operator options ---
def operator_report(results: Dict[str, float], threshold: float = 0.95, detail: dict = None) -> None:
    results_detail = detail or {}
    if 'detect_alignment' in results:
        status = 'PASS' if results['detect_alignment'] >= threshold else 'FAIL'
        print(f"detect_alignment      : {results['detect_alignment']:.2f} [{status}]")
        if results['detect_alignment'] < threshold:
            print("- File is missing required lares URI wrappers. Run detect_alignment.py for remediation.")
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
                print("- This LOCI is not canonicalized. Options:")
                print("    * Register in truename/LOCI.md (canonical registry)")
                print("    * Create a pointer file (e.g., LOCI.pointer) with lares URI metadata")
                print("    * Make this file a pointer to a canonical True Name registry")
                print("    * Continue talk story and decide what to canonicalize")
            elif k == 'nested_ooda':
                print("- Document nested OODA-A loops, parent/child references, and entry/exit conditions if present.")
            elif k == 'ahu_syntax':
                print(f"- Fix ahu marker URIs: {results_detail.get('ahu_syntax', '')}")
                print("  ahu form: <!-- ahu lares:///ha.ka.ba/path/?confidence=X#section-name -->")
                print("  Note: ahu is a bookmark — fragment is a plain section name, NOT chronometer form.")
            elif k == 'kahea_syntax':
                print(f"- Fix kahea marker URIs: {results_detail.get('kahea_syntax', '')}")
                print("  kahea form: <!-- kahea lares:///ha.ka.ba/path/ -->  (whole locus)")
                print("  or:         <!-- kahea lares:///ha.ka.ba/path/#section-name -->  (section pull)")

def batch_verify_loci(root_dir, registry_path, threshold=0.95):
    batch_results = []
    for loci_path in Path(root_dir).rglob('LOCI.md'):
        res, _ = verify_loci(str(loci_path), registry_path)
        batch_results.append({'file': str(loci_path), 'results': res})
    return batch_results

if __name__ == '__main__':
    import argparse
    import json
    parser = argparse.ArgumentParser(description='Verify a Lares LOCI file or directory for operational compliance. The registry is the true-name registry (grammar/LOCI.md).')
    parser.add_argument('loci', help='Path to LOCI.md file or directory')
    parser.add_argument('--registry', default='../../grammar/LOCI.md', help='Path to grammar registry')
    parser.add_argument('--threshold', type=float, default=0.95, help='Pass threshold (default 0.95)')
    parser.add_argument('--batch', action='store_true', help='Recursively verify all LOCI.md files under a directory')
    parser.add_argument('--report', type=str, default=None, help='Write full JSON batch report to file')
    args = parser.parse_args()
    if args.batch:
        batch_results = batch_verify_loci(args.loci, args.registry, args.threshold)
        if args.report:
            with open(args.report, 'w', encoding='utf-8') as f:
                json.dump(batch_results, f, indent=2)
        print(json.dumps(batch_results, indent=2))
        sys.exit(0)
    else:
        results, detail = verify_loci(args.loci, args.registry)
        operator_report(results, args.threshold, detail=detail)
# → ?
