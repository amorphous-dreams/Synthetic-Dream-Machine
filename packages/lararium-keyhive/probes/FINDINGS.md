# D.1 Probe Findings — @keyhive/keyhive @ 0.0.0-alpha.56c

> Run: `pnpm exec tsx packages/lararium-keyhive/probes/operator-delegate-device.ts`
> Date: 2026-05-08
> Verdict: **WORKABLE**. Pre-alpha label is technically correct (no security audit, version 0.0.0-alpha.56c), but the API itself answered every Q1–Q5 question on the first or second iteration.

## Summary

The probe exercised: install + import → two `Keyhive` peers up via `Keyhive.init(signer, store, handler)` → contact-card exchange → operator generates a `Document` → operator `addMember(device, doc.toMembered(), Access.admin, [])` → returns a `SignedDelegation`. All paths landed clean.

## Q1 — Install + import

✅ **Clean.** `pnpm add @keyhive/keyhive@0.0.0-alpha.56c` resolved without conflicts. tsx imports the package via its `node` exports condition (`./pkg-node/keyhive_wasm.js`). Bundle size: 8.8 MB unpacked (WASM payload).

Cold-init timing under tsx:
- First `Keyhive.init()`: 10–13 ms
- Subsequent: 2–4 ms

## Q2 — Operator-key compatibility

✅ **`Signer.memorySignerFromBytes(seedBytes: Uint8Array)` accepts arbitrary 32-byte seeds.** Direct path for our `operator-key.ts` ed25519 key — D.3 just feeds the existing seed in.

Other Signer factories surfaced:
- `Signer.generate()` — async, fresh random
- `Signer.generateMemory()` — sync, fresh random
- `Signer.generateWebCrypto()` — browser-native via WebCrypto API
- `Signer.webCryptoSigner(keypair)` — adopt an existing WebCrypto keypair

## Q3 — Operator-delegate-device flow

✅ **End-to-end works.** Confirmed sequence:

```
1. Each peer: const kh = await Keyhive.init(signer, store, handler);
2. Each peer: const card = await kh.contactCard();
3. Both peers exchange cards:
     await operator.receiveContactCard(deviceCard);
     await device.receiveContactCard(operatorCard);
4. Operator mints a scope document:
     const cid = new ChangeId(new Uint8Array(32));   // ChangeId(bytes) is the constructor
     const doc = await operator.generateDocument([], cid, []);
5. Operator adds device as admin member:
     const deviceAgent = await operator.getAgent(deviceIndividual.id);
     const access = Access.tryFromString("admin");
     const signedDelegation = await operator.addMember(
       deviceAgent,
       doc.toMembered(),       // Document → Membered conversion
       access,
       [],
     );
6. signedDelegation is a `SignedDelegation` ready for transport.
```

**Mapping to our bag model:** each Lararium bag (Automerge doc URL) IS a Keyhive `Document`. Members of a bag-doc carry caps over that bag. `cap=infrastructure` for own devices = `addMember(device, adminBag.toMembered(), "admin")`. `cap=promote` on a specific corpus bag = `addMember(peer, corpusBag.toMembered(), "admin"|"write")` — depends on what abilities Keyhive's `Access` enum offers (we tried only "admin"; need to enumerate).

**Pitfalls discovered:**
- `ChangeId` has a public `constructor(bytes: Uint8Array)`, NOT a static `fromBytes`. The probe's first iteration assumed `fromBytes` — failed silently.
- `Document` does NOT auto-convert to `Membered`. Must call `doc.toMembered()` explicitly. `addMember(...)` rejected the implicit cast with "expected instance of Membered".
- `Stats` returns a wasm-pointer object; need to read its getters via the `.d.ts`, not via `JSON.stringify`.

## Q4 — Event serialization for transport

✅ **`Archive` is the natural state-persistence shape.** `kh.toArchive()` → `Archive` → `archive.toBytes(): Uint8Array`. Reverse: `new Archive(bytes)` + `archive.tryToKeyhive(store, signer, handler)` → restored Keyhive.

Sizes from probe:
- Operator with no docs/members: 5,080 bytes
- Operator after generating doc + adding 1 member: 9,424 bytes

For incremental sync (peer-to-peer, not full state shipment), Keyhive exposes:
- `kh.eventsForAgent(agent)` → Map<hash, serializedEventBytes>
- `kh.ingestEventsBytes(bytesArray)` → Promise<results>
- `kh.eventHashesForAgent(agent)` → Array<hash>
- `kh.pendingEventHashes()` → Set<hash>

This is the seam for our admin-doc storage: persist the archive (or the event log) as tiddlers under `lar:///ha.ka.ba/@lararium/@admin/cap/...`. **D.4 design recommendation:** store events one-per-tiddler keyed by hash; reconstruct via `ingestEventsBytes` on daemon boot. Avoids serializing/deserializing the whole archive on every change.

## Q5 — Bundle / startup time

- Cold `Keyhive.init`: ~12 ms (acceptable; happens once per daemon boot)
- Archive serialize 9 KB: ~4 ms
- WASM cold-load (one-time per process): not separately measured but folded into first init; subsequent peers init in ~3 ms which suggests negligible.

Bundle size: 8.8 MB unpacked. Acceptable for a Node daemon. Browser bundle will need code-splitting; the pre-bundler `pkg/keyhive_wasm.js` includes the WASM as a base64 blob which Vite can chunk separately.

## Q6 — Glaring panics, missing methods, surprises

✅ **No panics encountered** during the probe sequence. The pre-alpha label is conservative; the API is more solid than "DO NOT USE IN PRODUCTION" suggests.

**Surprises:**
- `Keyhive.init(...)` requires an `event_handler: Function`. Our probe passed an array-pushing closure; the handler fires for every internal event. We'll wire this into the dispatcher in D.5.
- `whoami` and `idString` are getter properties (synchronous), but `individual` is a promise.
- Many types have private constructors (Access, Agent, Capability, etc.) — they only come from method calls. Direct `new` is rare; mostly `tryFromString`, `getAgent`, factories.
- The probe surfaced `setPanicHook` as a top-level export — useful for production: install once at process start to get readable stack traces from Rust panics.

## What to NOT bet on

- **Wire format stability.** Brooklyn's team may rev the archive format or event encoding between alpha versions. We accept the version-bump-with-migration model the operator named; HANDOFF entries should pin our `@keyhive/keyhive` version explicitly and treat upgrades as planned breaking changes.
- **Security guarantees.** No audit. For a single operator + family RPG sessions: acceptable. NOT acceptable for any future deployment with adversarial peers.
- **API stability.** `addMember` may grow/shrink params, `Document.toMembered()` may rename. We isolate behind a `CapabilityProvider` interface (D.2) so the blast radius of upstream renames stays localized.

## Recommendation for D.2+

- **Adopt `@keyhive/keyhive` as our cap layer.** Pre-alpha is workable for our scale.
- **Bag = Keyhive Document.** Each Automerge bag URL becomes a Keyhive scope document.
- **Persist via incremental events, not full archive replays.** Store events as tiddlers under `lar:///ha.ka.ba/@lararium/@admin/cap/<hash>`; reconstruct by `ingestEventsBytes` at boot.
- **Pin our version.** Treat upgrades as planned breaking changes per operator's stated migration policy.
- **Install `setPanicHook`** at every process boot (daemon + future browser).
- **D.2 `CapabilityProvider` interface** wraps roughly: `init(seed)`, `delegate(audienceContactCard, bagUrl, ability)`, `revoke(delegation)`, `verify(delegation, ability, bagUrl)`, `serializeEvents()`, `ingestEvents(bytes)`. Narrower than the 10-method UCAN-shape — Keyhive does more in fewer calls.
