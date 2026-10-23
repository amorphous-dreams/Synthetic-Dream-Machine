# OODA-HA runs the Loom: executable, fractal control plane

**Authority:** The current `projection_loom.ooda` and `WideEpoch` contracts. The
noosphere boot defines the five-phase practice; this implementation adopts its
sequence as a **runtime state machine**. It does not confuse the developers'
Aftermath/self-review practice with a new architectural material or geometry
feature.

## One location, nested loops, five guarded phases

The machine advances `observe -> orient -> decide -> act -> aftermath -> closed`.
The closing boundary can reopen another loop at Observe. Production epochs
normally grow under their location's Act, and CAD candidate loops under their
epoch's Act. **Any active phase** can additionally open a child inquiry; the
child records its immutable `parent_phase` and finishes a full five-phase cycle
before the parent may leave that phase. Neither the parent nor an inquiry can
close with an open child. This recursion is *optional*, not a forced five-way
fan-out. Each transition persists a receipt, not a post-hoc phase label.

```mermaid
flowchart TD
  L[Location OODA-HA] --> E[Epoch OODA-HA]
  E --> C[Candidate OODA-HA]
  C --> O[Observe proposal/evidence]
  O --> R[Orient source, emitter, guards]
  R --> D[Decide CAD audition]
  D --> A[Act: grow -> BRep + void audit -> score]
  A --> H[Aftermath: validity, outcome, next bearing]
  H --> E
  E --> P{Operator review gate?}
  P -->|Yes| Q[Checkpoint + previews + pet-name/o-takiage/choose]
  P -->|No| N[Bounded auto selection]
  Q --> N
  N --> L
```

The **candidate Act wraps the real CAD operation**. The staged evaluator invokes
its `before_candidate` hook after scheduling and before regrowth and the
`after_candidate` hook after saving its result. On reentry, completed CAD
receipts are never silently re-evaluated. A missed child receipt can be rebuilt
from its saved independent CAD checkpoint.

## Adjustable authority: continuous autonomy [0, 1]

The operator can change a run's policy at safe boundaries. There are four
named waypoints on one continuous gradient:

| Preset | Default autonomy | Operator control | Machine behavior |
|---|---:|---|---|
| `manual` | 0.00 | Operator guides; AI can suggest | Stop at each epoch plan and result review |
| `co-pilot` | 0.40 | Shared guidance | Draft plan automatically; require reviewed selection |
| `auto-nav` | 0.75 | Machine guides, operator can intervene | Select bounded valid elites; honor pause/review/steer commands |
| `full-speed` | 1.00 | Machine selects within existing scope | No optional gates, but still honors explicit pause/review at safe points |

Custom `--autonomy` values choose intermediate policy strengths. Values below
0.25 require a plan approval; below 0.60 require review of candidate previews.
A preferred emitter may influence the next lineage **only within a bounded
measured loss margin**. Operator `choose` may select any validated, scored preview, including a
non-champion that contributes a novel emitter or relational phenotype. Rejected,
deferred and unscored candidates never enter the operator's selectable set. Every mode shares exact
CAD validity, void-route checks, fixed-evidence-camera requirements, provenance
checks, budgets, and archive admission gates.

The command-line policy's autonomous choices currently derive from **deterministic
loss ranking plus bounded operator preference**, not an LLM. The Python
`run_ooda_epochs(..., adviser=callable)` hook admits an external AI adviser that
can propose only an already validated preview option and a rationale; operator
control remains authoritative. No network service or AI-provider credentials
are assumed.

## Hand-off, preview, pet-name, review, o-takiage

`ooda-run` (also the `wide-epoch` CLI) establishes `out/session.json`,
`out/status.json`, individual `out/epoch_NNN.json` CAD checkpoints and a
`out/previews/epoch_NNN/review.json` with actual image previews, genome files,
relational witnesses, CAD-evidence status and losses. The review panel includes
quality-diversity archive elites **and** optional validated alternatives, so
operator judgment can preserve a surprising form the optimizer would discard. A preview is a projection
of newly regrown validated CAD, **not ground-truth survey evidence**.

```bash
# First pass: manual waits on an Observe/Orient/Decide planning checkpoint.
python -m projection_loom ooda-run \
  --project examples/grammar/project.json --out out/ooda \
  --passes 3 --candidates 9 --exact-budget 6 --detail-budget 3 \
  --control manual --topology-locus branch
python -m projection_loom ooda-status --session out/ooda/session.json
python -m projection_loom ooda-steer --session out/ooda/session.json \
  --action approve-plan
# Repeat the identical ooda-run invocation to advance to the candidate review.
# Browse out/ooda/previews/epoch_001/review.json and its PNGs/witnesses.
python -m projection_loom ooda-steer --session out/ooda/session.json \
  --action pet-name --proposal candidate-0002 --target '~p-0003' \
  --name 'Bridge With Opinions' --has bridge
python -m projection_loom ooda-steer --session out/ooda/session.json \
  --action choose --proposal candidate-0002
# Repeat ooda-run to grow the next epoch from the chosen genome.
```

To loosen that name's hold at a future review, queue `--action o-takiage
--name 'Bridge With Opinions'`; or to release an entire fork, specify
`--action o-takiage --proposal candidate-0002 --branch '~p-0003'`.
The location's pet-name and other branches can persist. All such actions run
against a source-linked witness in the epoch's Aftermath and cannot alter the
already-scored generation's frozen ledger.

To intervene during an `auto-nav`/`full-speed` process, another process may queue:

```bash
python -m projection_loom ooda-steer --session out/ooda/session.json --action pause
# The runner stops at the *next candidate/phase safe point*, not mid CAD Boolean.
python -m projection_loom ooda-steer --session out/ooda/session.json --action review
python -m projection_loom ooda-steer --session out/ooda/session.json \
  --action prefer-emitter --emitter topology
python -m projection_loom ooda-steer --session out/ooda/session.json \
  --action set-autonomy --autonomy 0.40
python -m projection_loom ooda-steer --session out/ooda/session.json --action resume
# Reinvoke the same ooda-run arguments if the process has returned.
```

Controls enter immutable inbox files. The single runner applies each once and
appends an event to a digest-checked journal. Controls submitted before a review
that require a review witness wait until the preview becomes available. The
initial run's identity already reserves a default `out/identity-ledger.json`
location, so a pet-name may arrive only after the first preview without making
the original session incompatible.

## Phase-anchored inquiries: deepen attention without forcing recursion

A named loop or nameless location may open a bounded child investigation within
**any** active OODA-HA phase. That inquiry completes its own
`observe -> orient -> decide -> act -> aftermath -> closed` progression. The
parent remains at its original phase until the child closes, and the journal
records both the anchor and the return. An inquiry may itself open another
inquiry inside its own Aftermath (or any other phase), with a configurable
safety budget. The recursion pattern invites attention; it does not require
all five phases to spawn children.

A practical example pauses a manual epoch review, opens a child inside its
Aftermath, and then returns to exactly the same validated preview options:

```bash
python -m projection_loom ooda-steer --session out/ooda/session.json \
  --action open-inquiry --loop epoch-0001 \
  --question 'What does the newly grown gallery connect?'
# Reinvoke the matching ooda-run command to apply the queued control.
python -m projection_loom ooda-status --session out/ooda/session.json
# Read the 'awaiting.loop' inquiry id from the status response:
python -m projection_loom ooda-steer --session out/ooda/session.json \
  --action advance-inquiry --loop '<inquiry-loop-id>' --phase orient \
  --note 'The gallery touches the upper landing'
# Repeat advance-inquiry for decide, act, aftermath, closed, then rerun.
# Each explicit receipt records the Operator/AI pair's observation or decision.
```

`--action open-inquiry` accepts an active parent loop. The phase at the safe
boundary becomes its immutable anchor; an already-closed parent cannot receive
one. `--action advance-inquiry` advances **one legal phase at a time**, and
`--note` records what the Operator/AI pair observed, chose, did, or concluded.
Closing the child restores a suspended plan/review checkpoint, including its
original options. A control delivered during an unsafe change of phase fails
openly rather than acquiring a misleading historical anchor.

The Python API also supports optional `run_ooda_epochs(..., phase_adviser=...)`.
This callback receives a documented snapshot for each epoch phase and can
return either `None` or `{'question': '...'}`. The resulting child blocks the
phase until the Operator/AI pair advances it; no LLM provider comes built in.
The callback cannot waive CAD validity or pretend that written phase notes ran
an external computation. This distinguishes actual candidate Act (real CAD
execution) from inquiry Act (an operator/AI action receipt, with separately
owned tools as appropriate).

Recursion limits default to 12 nested levels and 4096 loops per session;
`--max-depth` and `--max-loops` configure them when starting a fresh run.
An in-flight run retains its limits and input/code fingerprint. Changing those
constraints requires a new session, not a silent mutation of its history.

## Failure, safety and persistence

- **Fractal invariants:** phases never skip ahead; child inquiries can run
  inside Observe, Orient, Decide, Act or Aftermath; the parent cannot exit
  the anchoring phase while any child remains open. Ordinary epoch/candidate
  children continue to grow from parent Act. Finite, configurable recursion
  depth and total-loop budgets prevent accidental runaway fan-out.
- **Durability:** source hashes, code hash (all active Python modules and the
  builder), budgets, deterministic proposal seeds and session identity determine
  reentry. Changed code or sources require a *fork*, never silent in-place resume.
- **No fake geometry:** candidate approvals require a valid fused BRep body and
  authored void route checks; a rejected candidate never receives a selection
  option. Evaluator failure remains separate from construction failure.
- **Boundary of interruptions:** the runner checks its inbox before each CAD
  candidate and at epoch decisions. It cannot forcibly cancel an in-progress
  CadQuery/OpenCascade call. A process crash leaves a runner lock requiring
  manual inspection before removal.
- **Trust boundary:** this initial control inbox is suitable for a trusted
  local Operator/AI pair. It is *not* an authenticated multiuser web service and
  does not implement distributed causal merging, timeouts, or remote notifications.
- **Adviser boundary:** external adviser callbacks suggest choices and reasons;
  the callback may not waive audits or invent options. A pure scoring heuristic
  serves CLI auto-navigation until an actual AI provider is connected.
- **Research boundary:** a repeated, unverified image does not establish
  camera calibration or metric scale. The controller makes this explicit in
  the review receipts and never turns previews into new ground truth.

## Precedents and cautionary notes

- LangGraph's interrupt/checkpoint/resume semantics:
  https://docs.langchain.com/oss/python/langgraph/interrupts
- AWS durable workflows suspend work without holding a process running:
  https://docs.aws.amazon.com/durable-execution/patterns/best-practices/pause-resume/
- Harel-style statecharts: hierarchical state boundaries and guarded transitions.
  https://www.sciencedirect.com/science/article/pii/0167642387900359
- LangGraph human-in-the-loop cautions: after interruptions, node code may
  replay; isolate side effects and persist phase receipts before re-entry.
  https://docs.langchain.com/oss/python/langgraph/interrupts
- Event-sourced persistence: immutable operator interventions and explicit
  run identity rather than mutable undocumented guidance.

These principles inform a small, dependency-light local state machine rather
than importing an agent framework whose failure and replay semantics would
have to be audited independently.
