# Browser Smoke — Lararium Host Opening Loop

Manual smoke script for P2 verification of the async host opening sequence.
Run after every change to `lararium-browser-host.ts`, `LarariumShell.tsx`,
`LarariumCanvas.tsx`, or `serve.ts`.

## Prerequisites

```bash
# Start the node server
pnpm --filter @lararium/node dev

# Build the app (or use vite dev server)
pnpm --filter @lararium/app build
# or: pnpm --filter @lararium/app dev
```

Open browser devtools console before loading the page.

---

## Pass 1 — Native mode (no TW5 boot)

**URL:** `http://localhost:5173` (no query params)

### Checks

| # | Check | Pass condition |
|---|-------|---------------|
| N1 | No blocking spinner | tldraw canvas renders immediately; no full-page loading screen |
| N2 | No `Unknown switch case` error | Console shows no `Unknown switch case [object Object]` |
| N3 | No empty text node error | Console shows no `RangeError: Empty text nodes are not allowed` |
| N4 | No meta leak | `__larariumDebug.receiptShape?.meta` has no `id` or `typeName` keys |
| N5 | Receipt shape exists | `__larariumDebug.receiptShape` is non-null after sync |
| N6 | Receipt upgrade fires | `__larariumDebug.hostReceipt` transitions from `null` to a SHA-256 hex string |
| N7 | Projection-cache timing | `__larariumDebug.hostReceipt` is non-null before `tiddlerStore` receives any writes |
| N8 | TW5 not booted | `__larariumDebug.tw5` is `null` |
| N9 | Double-click meme zooms | Double-click a meme frame → camera zooms to meme; no JS error |
| N10 | No canon promotion | `tiddlerStore.listVisible()` returns meme URIs; no `lares/` prefixed titles |

### Console verification sequence

```js
// After page loads and syncs (store.status === "synced-remote"):

// N5: receipt shape present
__larariumDebug.receiptShape
// expect: { id: "shape:lararium_boot_receipt", meta: { metaKind: "boot-receipt", receiptHash: "...", ... } }

// N4: no id/typeName in meta
Object.keys(__larariumDebug.receiptShape?.meta ?? {})
// expect: does NOT include "id" or "typeName"

// N6: hostReceipt upgraded
__larariumDebug.hostReceipt
// expect: non-null SHA-256 hex string like "a3f2..."

// N7: projection-cache count
// (count rises only after hostReceipt is non-null)
await __larariumDebug.tiddlerStore?.listVisible()
// expect: array of lar:// URIs, length > 0

// N8: TW5 not booted in native mode
__larariumDebug.tw5
// expect: null

// N10: no canon paths
const titles = await __larariumDebug.tiddlerStore?.listVisible()
titles?.filter(t => t.startsWith("lares/"))
// expect: []
```

---

## Pass 2 — TW5 mode

**URL:** `http://localhost:5173?renderMode=tw5`

### Checks

| # | Check | Pass condition |
|---|-------|---------------|
| T1 | All N1–N7 pass | Same as native mode |
| T2 | TW5 boots | `__larariumDebug.tw5` is non-null after opening sequence |
| T3 | openPhase reaches "live" | `__larariumDebug.openPhase?.kind === "live"` |
| T4 | No TW5 boot crash | No `Error` in console referencing `tiddlywiki/boot` |
| T5 | carrierText seeds store | `tiddlerStore.listVisible()` resolves non-empty; meme carrier text available |

### Console verification

```js
// T2: TW5 booted
__larariumDebug.tw5
// expect: LarariumTW5 instance (non-null)

// T3: opening sequence complete
__larariumDebug.openPhase
// expect: { kind: "live", offset: 0 }

// T5: store seeded from carrierText
const titles = await __larariumDebug.tiddlerStore?.listVisible()
console.log(titles?.length, titles?.slice(0,3))
// expect: length > 0, titles start with "lar://"
```

---

## Pass 3 — Canon guard (manual invariant check)

No UI path exists for canon promotion yet — this pass verifies the guard stays
inert until ceremony lands.

```js
// In Node test env (not browser):
// pnpm --filter @lararium/node test -- --testPathPattern canon-promotion-guard
// expect: 9 tests pass, 0 fail
```

---

## Known non-issues (do not file as bugs)

- `Module "vm" has been externalized` — Vite warning from TW5 boot dependency. Non-fatal in native mode (TW5 not loaded). Expected in tw5 mode.
- `Module "crypto" has been externalized` — Same origin, same non-fatal status.
- Bundle size warning (>500 kB) — Deferred to Q2 recipe-config dynamic import phase.

---

## Failure triage

| Symptom | Likely cause | Fix vector |
|---------|-------------|------------|
| `Unknown switch case [object Object]` | Boot-receipt WS message re-added to serve.ts | Remove standalone WS send; receipt travels as snapshot shape only |
| `RangeError: Empty text nodes are not allowed` | Body-node geo shape emitting `richText("")` | Fix `richText()` in `tldraw-shapes.ts` to return empty paragraph |
| `receiptShape` is null | `injectBootReceiptFrame` not called in `buildBootProjection` | Check `serve.ts` snapshot building path |
| `hostReceipt` stays null | `useBridgeReceiptFromEditor` not wired, or boot-receipt shape missing `metaKind:"boot-receipt"` | Verify `lararium-browser-host.ts` hook call in `LarariumShell.tsx` |
| Projection-cache count = 0 | `hostReceipt` null at time of intake, or `carrierText` missing from shape.meta | Verify receipt bridge fires before intake effect; check projection output |
