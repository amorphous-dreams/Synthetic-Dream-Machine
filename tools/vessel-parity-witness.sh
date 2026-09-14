#!/usr/bin/env bash
# vessel-parity-witness — every vessel SHORE composes the capabilities the parity law binds.
#
# ── THE LAW, AND WHY IT HAD NO WELD ─────────────────────────────────────────────────────────────
# `open-browser-vessel.ts` states it in its own header: the BROWSER carries the SAME capabilities as
# node; only the SUBSTRATE differs — "the browser must NOT drift thin". `composeLararium` and
# `composeBrowser` are the same function over two substrates.
#
# Fourteen `*parity*` instruments stand in this tree — frame · head · sigil · turn · type · mirror ·
# surface · rendezvous · submission — and every one covers the GRAMMAR or a CLI SURFACE. Not one asked
# "does every vessel class compose this capability." So the law stood unmeasured, and it eroded TWICE
# in one day:
#
#   · `carryPersonaKelUpTheGradient` cured a bug that BRICKED A NODE VESSEL PERMANENTLY (7a60edab9) and
#     sat in `packages/lararium-node/`, where no browser leaf could import it — while it only ever
#     reached a Repo and the mesh board reader. The leaf carried a byte-identical fail-closed gate and
#     stood brickable for a full day with no `--force` knob at all. Moved to mesh at 6b0784571.
#   · `climbNexusBoards` was built in mesh DELIBERATELY so both shores compose it, and its header VOWED
#     platform-blindness while no leaf composed it. A vow reads aspirational for as long as it stands
#     unmeasured.
#
# ── WHAT THE GATE COMPARES, AND WHY THAT COMPARISON ─────────────────────────────────────────────
# Three comparisons offered themselves. The two that lost, and why they lost, are the design:
#
#   ✗ THE MESH EXPORTS EACH SHORE IMPORTS, set-equal. Measured first, because "derive, don't enumerate"
#     is the standing law: the node shore composes 474 shared symbols and the browser 131. Raw equality
#     needs ~343 named exemptions — a gate nobody maintains is a gate that goes green by exhaustion. The
#     asymmetry is also REAL and largely legitimate: node holds fs, py and R seats a leaf never gets.
#   ✗ THE COMPOSED CAP-STACK AT EACH VESSEL DOOR. Rejected on measurement, not taste: the node shore
#     composes `carryPersonaKelUpTheGradient` through `persona-kel-ring.ts`, a node-local re-export. A
#     door-file-only reading calls the node shore THIN and goes red on the shore that HOLDS the cure.
#     So the reading runs PACKAGE-WIDE per shore — a shore composes what its package imports anywhere.
#
#   ✓ A DECLARED ROSTER OF CAPABILITIES UNDER THE LAW, with the VERDICT DERIVED FROM SOURCE. The
#     subject list is a declared act; the answer is never. Each row names one shared-package symbol, and
#     the gate reads which shores actually compose it. Four classes, and the last three matter as much
#     as the first — A RULED SEAT DIFFERENCE IS NOT DRIFT, and calling one a gap would be its own defect:
#       · BOTH SHORES      — the law proper.
#       · RULED ASYMMETRIC — a seat difference canon rules, carrying its citation.
#       · OWED             — a measured asymmetry NOBODY has ruled. Not a failure; PINNED, so it can
#                            neither widen nor close unseen. The open-φ ledger in weld form.
#       · UNWIRED          — housed in mesh for both shores, composed by neither. The day one shore
#                            takes it up alone, this names the shore that stayed thin.
#
# ── WHY IT CANNOT GO GREEN BY INERTNESS ─────────────────────────────────────────────────────────
# This session measured two gates satisfied by their own emptiness: a control set made only of negatives,
# and an ordering assertion over an absent call (`indexOf` answers −1, and −1 sits below everything). So
# every arm here carries a positive floor or a both-directions assertion:
#   ① the shores must EXIST and each must read a NON-EMPTY composition set — a renamed package would
#     otherwise read as two empty sets that agree perfectly;
#   ② every roster symbol must resolve to a REAL export of its declared package — a renamed capability
#     goes red as SUBJECT VANISHED rather than sitting silently unmeasured (surface-parity read exactly
#     such a vanished subject as a clean run, 530c76ce7);
#   ③ two floors: the roster's own count, AND the parity arm's — because a roster could hold its size
#     while every row drifted into an exemption, and a gate satisfied entirely by exemptions measures
#     nothing;
#   ④ every declared asymmetry carries a REASON, and is PINNED to its measured holder set: a gap that
#     CLOSES goes red asking for the row's retirement, exactly as a gap that widens goes red. An
#     exemption cannot rot here inertly.
#
# PROVEN TO BITE: with the browser shore's `climbNexusBoards` import removed, the run exits 1 on
#   "THIN SHORE — the `browser` vessel does NOT compose `climbNexusBoards` from @lararium/mesh."
# Restored, it exits 0. Reads source only; needs no docker and no built dist.
#
# Exit 0 = every capability under the law reaches every shore, and every declared asymmetry still stands.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD" node tools/vessel-parity.mjs
