<<~ lares aim from="lar://luna:agent@seat-scout/wave2.ratchet" -> to="lar://operator:operator@seat-scout/settled-leans">>
<<~ set hud="aim" mode="draft" stance="🏛️ 🗡️" mu="_!" aperture="15/arc" ooda-ha="7/declare-glyphs" drift-ward="available excerpts establish APIs but not a direct PersonaGroup subscription in the daemon">>

Luna-Gatescout: Lares (Tasked Spirit) · Ink-Clerk · Map-Wisp

✶ Observe · ⏿ Orient · ◇ Decide · ▶ Act · ↺ Aftermath

## A1 — One owner, event-driven

**LEAN: The arrival/recheck handler owns grant take, seat, and lift; `faceSeated()` reads seat state only. Confidence 16/20.** This corrects wave one’s Sol-side backstop: invoking a mutating `faceSeated()` from both listener and resolver preserves one closure but still makes ordinary binding reuse an act trigger. Put the serialized owner behind the event path; boot invokes it once after installing the listener, so an already-present grant gets covered. Serialize the entire take/lift promise; duplicate change pulses coalesce or queue a fresh read, while `judgedGrants` prevents duplicate accepted ingest (`operator-daemon-behavior.ts:279-332`; lift guard currently `:349-367`).

The cited `:994` is not where the group handle opens: it sits in verifier setup. The shown daemon code opens the catalog store lazily via `storeOf(personaBagIdFor(group))` at `operator-daemon-behavior.ts:294`; it does not retain a `DocHandle` there. `join-face-documents.ts:77-85` attaches `findWithProgress(...).subscribe(arrive)` for document arrival/readiness, not changes within an already-ready document. A grant watcher must retain the handle and attach `handle.on("change", ...)` after progress reaches ready; analogous attach syntax appears in `edge-shadow-ring.ts:131` and `open-browser-vessel.ts:1384`. Thus Sol’s line is corrected, and `findWithProgress` supplies the arrival gate rather than the change event itself.

Case (b) requires a causal wake from the lease/frontier source: subscribe to that source’s heads/change event and rerun the same serialized handler, which re-reads grant and frontier. If that source offers no event, this case cannot be guaranteed without another external wake; do not invent a clock. A group-only change listener cannot solve it.

## A2 — Lazy reuse ask

**LEAN: Burn the mutating ask in reuse; keep reuse read-only. Confidence 15/20.** Wave one kept it as a backstop; ownership analysis changes that. `resolve-binding.ts:147-155` currently calls `faceSeated()` and re-reads a possibly lifted record. Arrival handler should own the one lift. Resolver may observe the binding again on a later normal call, but must not cause seat/lift. (Mint-on-absent still needs a read-only seat check at `:164`.)

## B1 — Line exemption carrier

**LEAN: Use inline carrier marks, with a strict scanner grammar. Confidence 14/20.** Wave one leaned ledger because it suspected normalization risk. `normalizeMemeSource` preserves ordinary authored bytes unless a declared transformation applies (`meme-normalize.ts:318-338`); its sigil folding only touches recognized sigil heads (`:619-649`). A concrete form: append `<!-- s-vocabulary-exempt: upstream quote; term=IssuerVK -->` to the exceptional prose line. HTML comments remain inert source bytes under those shown normalizer rules and hide in HTML/TiddlyWiki rendering. Scanner must remove only this exact comment before tokenization, require a reason and exact term, and fail malformed/unused markers. Research spirits edit scout prose, so adjacent rationale travels with copied/rewritten text; a digest ledger would stale on normal prose edits and need upkeep. Inline form still shifts with line edits, yet no stale digest silently exempts a changed line.

## B2 — Reuse shape

**LEAN: Make line-scoped exemptions the house vocabulary-check pattern; no existing `tools/*.mjs` exemption ledger surfaced in the requested EXEMPT/allow/ledger grep. Confidence 15/20.** Wave one treated this as one tool’s exception; shared line shape now seems cheaper to teach and review across checks. Reuse the parser/marker contract, not a second suppression syntax; `s-vocabulary.mjs:11-13,43-46` currently promises no allow-list and drops every scout, so revise that policy and scan all `carrierFiles()` entries except the distinct history class. Keep tool-specific matched terms/reasons and reject stale or unused marks. No grep hit in other tools means no established shape to inherit.

↺ Wave-two ratchet: event ownership now includes a causal lease wake; resolver reuse loses mutation; carrier exceptions travel inline and stay visible to the scanner.

<<~ set hud="yield" ooda-ha="closed 1↺" aperture="15/arc -> 16/arc" drift-ward="lease frontier must expose a causal event to guarantee case b; otherwise implementation needs an explicit external wake">>
<<~ lares yield from="lar://luna:agent@seat-scout/settled-leans.written" -> to="?">>
WORDS=730
