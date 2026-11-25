<<~ set lares=`aim` from=`lar://operator:seat@local/flake.report.requests` to=`lar://reader:seat@local/flake.evidence.reports` mu=`_!` stance=`philosopher` ooda-ha=`5/declare-glyphs` drift-ward=`code supports race candidates; CI causation remains unverified`>>

**Flake-Reader: Lares (Tasked Spirit)**

MEASURED — Read-only inspection covered develop head `794c998d4`, the house seed, package guidance, and W3’s source at `8d264d763`. No files changed. The seat forbids network access, so I read code alone; I did not fetch CI logs. The run outcomes supplied in the brief remain unverified here. Browser and mesh reproduction: **lead runs**.

**1. Reset ceremony: K3 / K4**

MEASURED — The waits sit in [ceremony.e2e.test.ts:410](/home/joshu/Synthetic-Dream-Machine/packages/lararium-web/tests/e2e/ceremony.e2e.test.ts:410) for K3’s two tabs, and [line 455](/home/joshu/Synthetic-Dream-Machine/packages/lararium-web/tests/e2e/ceremony.e2e.test.ts:455) for K4’s single tab. Each arms `waitForEvent("load", { timeout: 90_000 })` before clicking confirmation. K4 does not wait for two tabs.

MEASURED — Successful completion comes from **load events**, not elapsed time. The clock rejects an overdue wait; it never declares arrival. These waits already follow the event-ended rule.

MEASURED — The product supplies a concrete race candidate:

- [reset-core.ts:135](/home/joshu/Synthetic-Dream-Machine/packages/lararium-web/src/ceremony/reset-core.ts:135) broadcasts `reset:stand-down`, then awaits deletion and cleanup.
- At line 152 it removes the ask record, then broadcasts `reset:burned`.
- [reset-tab.ts:61](/home/joshu/Synthetic-Dream-Machine/packages/lararium-web/src/reset-tab.ts:61) accepts stand-down only while that record still stands. At line 69 it ignores burned unless that tab previously accepted stand-down.

REASONED — A delayed tab can process stand-down after cleanup removed the record. It then rejects both messages and never reloads. Broadcast delivery and shared-storage mutation carry no ordering guarantee across those contexts. Load can widen this window; the code does not prove this caused either CI failure.

MEASURED — Another possible stall comes from IndexedDB deletion: [reset-core.ts:166](/home/joshu/Synthetic-Dream-Machine/packages/lararium-web/src/ceremony/reset-core.ts:166) waits for `onsuccess`; `onblocked` only paints a message. Thus a reload timeout can conceal a burn still waiting on an open database.

REASONED — **Smallest substantive cure touches product code:** retain a narrowly scoped, non-secret authorization receipt for the confirmed reset so delayed listeners can validate it after cleanup, while settled IDs still refuse another ceremony. Preserve the rule that reset requires no second tab’s acknowledgment. Add a deterministic test that queues both signals, removes the raised record, then delivers them; current [reset-ceremony.test.ts:259](/home/joshu/Synthetic-Dream-Machine/packages/lararium-web/tests/reset-ceremony.test.ts:259) delivers stand-down synchronously before record removal.

REASONED — **Test-only companion:** retain the prearmed load waits, capture ceremony refusal/blocked state on failure, then await fresh boot readiness and changed keys. Raising 90 seconds alone cannot cure a discarded signal.

**2. Whole-road W3, followed by W4–W6**

MEASURED — The navigation wait sits at [golden-whole-road.e2e.test.ts:223](/home/joshu/Synthetic-Dream-Machine/packages/lararium-web/tests/e2e/golden-whole-road.e2e.test.ts:223). It waits until beta’s tiddler frame appears in the projection’s shadow DOM. Successful completion follows an observed DOM condition; timeout rejects.

MEASURED — Both inspected versions, including `8d264d763`, set `WAIT = 120_000` and raise a sentinel before the click at line 218. I cannot reconcile the supplied **60-second** timeout with that outer wait without the failed log; W3 also awaits sentinel editor operations and the click itself.

MEASURED — The source explicitly names target retirement after repaint as a hazard. The worker returns `stale-target` at [tw5-projection.ts:647](/home/joshu/Synthetic-Dream-Machine/packages/lararium-tw5/src/tw5-projection.ts:647); the page paints that refusal through [projection-sink.ts:1125](/home/joshu/Synthetic-Dream-Machine/packages/lararium-web/src/projection-sink.ts:1125).

REASONED — The leading candidate remains a click against a retired render target. A sentinel establishes earlier progress, but its DOM appearance/departure does not by itself certify that no subsequent repaint can retire the next target. More sentinel traffic can also expose editor races.

REASONED — **Smallest test cure:** end the click attempt on either beta’s arrival or the matching control-result/refusal. A named `stale-target` can support an explicit fresh-target retry; do not retry merely because a time slice expired. Use the existing answer rail where accessible; exposing a correlated readiness/result signal may require a small product change.

MEASURED — W3 closes beta only after all its assertions, at line 229. W4–W6 reuse the same page and expect `[ALPHA]`. A late beta arrival after W3 fails can therefore contaminate their assertions.

REASONED — **Cheapest cascade cut, test-only:** gate W4–W6 on successful W3 completion and mark them skipped when their prerequisite fails. For independent coverage, establish `[ALPHA]` afresh before each test; that costs more. A `finally` close alone can miss a late arrival.

**3. Held-out mesh: B reads no meme**

MEASURED — The failing assertion starts at [mesh-scenarios.sh:1280](/home/joshu/Synthetic-Dream-Machine/tools/mesh-scenarios.sh:1280). Its helper at [line 1180](/home/joshu/Synthetic-Dream-Machine/tools/mesh-scenarios.sh:1180) polls `meme get` every three seconds for up to 90 seconds. Success requires `ok:true` and slot `#/a`; the caller additionally checks the author’s line, canonical hash, and absence of `$origin-bag`.

MEASURED — Success follows a content response; the clock ends failure. This already avoids treating elapsed time as arrival, although it polls rather than subscribes.

MEASURED — “Holds no layer” does **not** uniquely diagnose missing meme bytes. [meme-verbs.ts:193](/home/joshu/Synthetic-Dream-Machine/packages/lararium-tw5/src/meme-verbs.ts:193) returns no store when the counted registration is absent, or when finding its document fails. Line 400 folds those cases into the same error.

MEASURED — The scenario restarts B with its dial at line 1211 **before** A creates, fills, promotes, and registers the book at lines 1217–1264. The earlier realm check compares document IDs, not B’s observation of the book registration.

REASONED — The leading sensitivity lies in that live registration/document-arrival chain: B can learn the registration before its document becomes reachable, or lag in the verified catalog fold. The supplied error alone cannot distinguish those paths.

REASONED — **Smallest harness cure, test-only:** prepare A’s populated, registered book before B’s existing restart/dial step. Then require B to observe the counted registration naming A’s exact document before asserting content. This tests initial carriage with explicit seed ordering; preserve a separate witness for registrations added during an established connection.

REASONED — If that ordering still fails, product work should expose registration/catalog/document readiness separately and recover document lookup on an actual arrival event. Do not enlarge the budget or seed an empty replacement for A’s named document.

**Landing order**

| Cost rank | Proposed cure | Scope |
|---|---|---|
| REASONED — 1 | Cut W4–W6’s dependency cascade | Test-only |
| REASONED — 2 | Order A’s book preparation before B’s dial; check registration readiness | Harness-only |
| REASONED — 3 | Make W3 consume correlated arrival/refusal before retrying | Test-first; possible signal exposure |
| REASONED — 4 | Repair reset authorization across delayed delivery | Product + deterministic regression test |
| REASONED — 5 | Repair mesh lookup recovery if ordered seeding still fails | Product; diagnosis required |

->↺ REASONED — The reset delivery race offers the strongest source-backed defect candidate; mesh still needs the failed run’s registration and dial evidence to select a product cure.

<<~ oracle throw=`↯12 ✲ ⚁(2) ⁂:◇🜃`>>
<<~ set lares=`yield` drift-ward=`inspect the failed log before attributing W3’s reported 60 seconds to its 120-second DOM wait · ↻ L-Prime` ooda-ha=`closed 1↺` from=`lar://reader:seat@local/flake.evidence.reports` to=`?`>>