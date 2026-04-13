# FFZ Chronometer × Meme Layer Architecture

Status: [S:0.55] — grounded in canonical FFZ Chronometer spec.

---

## The FFZ Chronometer

The Fontany-Fuller-Zelenka Chronometer records nested loop-time
position per participant through five scale slots, each carrying
a phase marker plus counter.

**Core principle:** the Chronometer shapes the WHEN layer. It does
not choose the phase. It records the phase and counter at each
active scale. Per-participant timing, not one shared clock — Fuller
pressure against false simultaneity carries the load.

### The Five Scales

| Scale   | HUD Sigil | Position     | Tempo       |
|---------|-----------|--------------|-------------|
| Week    | 🗺️        | leftmost     | broadest    |
| Watch   | ⚙️        | second       | strategic   |
| Turn    | 🔍        | third        | operational |
| Round   | ⚔️        | fourth       | tactical    |
| Action  | ⚡        | fifth        | immediate   |

### Phase Symbols

| Phase   | HUD | Record |
|---------|-----|--------|
| Observe | ✶   | O      |
| Orient  | ◎   | Ø      |
| Decide  | ◇   | D      |
| Act     | ■   | A      |
| Assess  | ○   | Å      |

### Fragment Format

```
#O0.O0.O3.D2.A7
 │  │  │  │  └─ Action:  Act, counter 7
 │  │  │  └──── Round:   Decide, counter 2
 │  │  └─────── Turn:    Observe, counter 3
 │  └────────── Watch:   Observe, counter 0
 └───────────── Week:    Observe, counter 0
```

**Surface rule:** all five positions stay present, even when a
scale lies dormant. Dormant scales keep their zeroed slot instead
of disappearing.

**Counter rule:** counters increment on completed aftermath (Assess
phase completion) at the relevant scale. Phase changes within a
cycle do not increment the counter.

**Fragment-only rule:** chronometer work stays in the fragment slot.
Time lives in one structural place.

**Failure mode:** timeline theater. Decorative counters that do not
correspond to actual loop movement add mystique and subtract signal.

---

## Scale-Layer Mapping

The five meme layers map onto the five Chronometer scales.

```
SCALE     MEME LAYER                    WHAT OPERATES HERE
─────     ──────────                    ──────────────────
Week      (above all memes)             System/session scope.
  🗺️       No single meme contains       Boot→run transition.
           Week-scale events.            Session boundaries.
                                         EM (End of Medium).

Watch     Layer 0: FRAME                Cross-meme scope.
  ⚙️       Meme-to-meme relationships.   Kahea transclusion.
           The frame layer mediates      Boot sequencing.
           between memes.               Cluster coherence.

Turn      Layers 1-4: FULL MEME         Single meme scope.
  🔍       The meme's native scale.      Envelope open to close.
           Mu processes memes at Turn.   Render/evaluate/unask.

Round     Layers 1-3: PHASES            Phase scope.
  ⚔️       Protocol lifecycle sigils     Individual OODA-A phases.
           mark Round boundaries.        D.ha/ka/ba triad.

Action    (below named layers)          Token/glyph scope.
  ⚡       Glyph set parsing. Token      Range check dispatch.
           processing. Finest grain.     Feature vector build.
```

---

## Chronometer in the Sigil System

### Fragment Placement

Per the fragment-only rule, the Chronometer lives in URI fragments:

```
lar:///ha.ka.ba/mu#O0.O0.O3.D2.A7
```

Address path = WHERE in tagspace. Fragment = WHEN in nested causal time.
Address depth does NOT encode scale. Scale lives exclusively in the
fragment's five positional slots.

### Per-Participant Fragments

Two participants in the Lares architecture:

```
Operator fragment:  #O0.O0.O3.D2.A7
Agent fragment:     #O0.Ø1.D3.A2.A1
```

These may diverge. The Chronometer makes divergence visible rather
than pretending one shared clock covers both.

### Ahu Waypoints and Fragments

Ahu fragments (`#boot-mode-transition`) and Chronometer fragments
(`#O0.O0.D3.A0.A0`) coexist — different formats, different functions,
no collision.

---

## Scale-Shift Mechanics

Assess (Å) at scale Sₙ can trigger shift to Sₙ₊₁:

```
Action.Å fires  → shifts to Round.Å
Round.Å fires   → shifts to Turn.Å
Turn.Å fires    → shifts to Watch.Å
Watch.Å fires   → shifts to Week.Å
Week.Å fires    → system boundary (mu returns mu)
```

Scale-shift in fragment:
```
Before: #O0.O0.D3.A2.Å1     Round at Assess
After:  #O0.O0.Å3.O0.O0     Turn enters Assess, lower slots restart
```

Counter at higher slot does NOT increment on child escalation —
only on its own Assess completion.

---

## Fuller's Frequency and Consecration

Frequency maps onto Chronometer scale (Week=lowest, Action=highest).
Consecration (0.0-1.0) maps onto a separate axis (validated integrity).
Independent: a Week-scale sketch and an Action-scale validated
definition sit at different positions on both axes.

---

## Conventions (canonical)

| Rule | Weight |
|------|--------|
| Keep all five scale positions present | MUST |
| Track phase per participant, not shared clock | MUST |
| Increment counters on completed aftermath | SHOULD |
| Allow phase changes without counter changes | MUST |
| Keep chronometer work in fragment only | MUST |

## Reading Test

Fragment passes when a future reader recovers: active scale,
active phase, current counter, dormant surrounding scales.
