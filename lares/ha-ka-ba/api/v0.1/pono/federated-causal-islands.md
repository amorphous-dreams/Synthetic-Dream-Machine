<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/pono/federated-causal-islands >>

<<~ ahu #iam >>

```toml
uri-path     = "ha.ka.ba/api/v0.1/pono/federated-causal-islands"
file-path    = "lares/ha-ka-ba/api/v0.1/pono/federated-causal-islands.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "invariant"
confidence   = 0.82
register     = "CS"
manaoio      = 0.80
mana         = 0.84
manao        = 0.82
role         = "invariant law: Fuller-Zelenka non-simultaneous apprehension as ontological basis; causal island tiers 0–3; authority-first sync order; edge-island identity, lifecycle, relay semantics"
cacheable    = true
retain       = true
invariant    = true
```

<<~/ahu >>


<<~ ahu #law >>

## Ontological Basis (Fuller-Zelenka)

Events in Universe are not simultaneously apprehended by any observer.
A node never holds the full state of a distributed system "at once."
It holds a snapshot of what it has synchronized so far.
This is not a limitation. It IS the topology.

Simultaneously apprehended: your local Automerge doc snapshot, right now.
Non-simultaneously apprehended: everything else —
- other peers syncing the same doc (you see their state at last sync)
- other Automerge Realms reachable from this one on the network
- tiddlers not yet hydrated in the local TW5 instance
- kumu/active-meme instances whose trigger surface is their own event horizon

Any boundary across which causality cannot be guaranteed simultaneously IS a causal island boundary.
The tier map below names these boundaries from innermost to outermost.

## Law

A node-to-node pranala connection IS a causal island.

It is not a transport. It is not a socket. It is a named, capability-gated causal
boundary between two Lares nodes carrying its own identity, durable offset, stream
log, reconciliation state, visibility predicate, revocation epoch, and receipt history.

A room WebSocket connection is NOT an edge island. A room connection is session-scoped
and ephemeral. An edge island is persistent, named, and authority-bearing.

An Automerge Realm (a distinct Automerge doc) is ALWAYS non-simultaneously apprehended,
regardless of where it was first encountered on the network.

<<~/ahu >>

<<~&#x0002;>>


<<~ ahu #edge-island-shape >>

## Edge Island Shape

Every edge island MUST carry:

```toml
id                = "edge:${sourceNode}:${targetNode}:${epoch}"
capability        = "Orichalcum proof authorizing this connection"
offset            = "monotonic frame count — belongs to the edge island, not the remote node"
epoch             = "revocation generation; rolling epoch terminates prior live-tail access"
visibility-gate   = "canFederate(meme, room, edge, subject) — see gate law below"
receipt           = "issued after each meaningful transition; hash-stable for prompt cache"
```

### Visibility Gate Law

A meme passes the federation gate when ALL of the following hold:

```
rating(meme)    >= Meme           # structural ladder: Noise/Data/Meme/Ano/Kapu
manaoio(meme)   >= room.minManaoio
recipe(room).matches(meme)
hasAbility(subject, "sync", edge.id)
!edge.revoked
!violatesKapu(meme, subject)
```

`rating` is the structural quality gate: has the carrier achieved lawful meme shape?
Noise and Data are node-local only. They do not federate regardless of any other condition.

Stage band (GR/OS/US/CS/DS) is a UX rendering annotation — it governs visual presentation
in the masks/voices layer, not federation eligibility. Room recipes MAY filter by stage
as an operator-configured predicate, but stage is not a hardcoded gate condition here.

The offset belongs to the edge island. An edge island that reconnects after downtime
resumes from its last known offset — it does not re-sync from the beginning.

<<~/ahu >>

<<~ ahu #sync-order >>

## Authority-First Sync Order

Content MUST NOT precede authority. This invariant has no exceptions.

```
1. authenticate peer / node / device
2. sync Orichalcum authority graph
   (membership, capabilities, delegations, revocations)
3. derive visible room recipe + visible causal islands
4. sync collection manifest
   (rooms, memes, edge islands, receipts)
5. for each visible island:
   a. capability / epoch ops
   b. CRDT heads
   c. delta payloads
   d. projection receipts
```

A relay that has not completed step 2 MUST NOT receive step 4 or later.
A peer that has not completed step 3 MUST NOT request individual meme deltas.

<<~/ahu >>

<<~ ahu #lifecycle >>

## Edge Island Lifecycle

```
stable sediment | current boot receipt | live delta tail
```

- **Join:** receive boot receipt first — the shape of the visible world at join time.
  This is not a full CRDT sync. It is a snapshot of what this peer is currently
  authorized to see.
- **After join:** request missing deltas from the last known offset.
- **Revocation:** epoch rolls. The revoked principal receives no future live tail.
  Past sediment encrypted at prior epoch keys remains readable by those who held
  those keys. Revocation is forward-only.
- **Receipt:** emitted after join, after each epoch change, after each
  canon-promotion ceremony. Receipts are hash-stable and usable as prompt cache keys.
- **Re-seeding:** boot receipt re-issued; sediment layers may compact;
  live tail resets from new offset zero.

<<~/ahu >>

<<~ ahu #relay-law >>

## Relay Law

A trust-minimized relay holds `pull`, not `read`.

```
pull  — retrieve encrypted bytes and forward them; cannot decrypt or render
read  — decrypt and render semantic content
```

A relay MUST NOT be granted `read` unless it is also a trusted peer with
an Orichalcum capability carrying the `read` ability.

A shrine relay carries offerings it cannot understand. This is correct posture.
The altar does not require the relay to comprehend the offering to carry it.

<<~/ahu >>

<<~ ahu #tier-map >>

## Tier Map

```
Tier 0 — active programming memes (kumu instances, UEFN device analogues, kahea invocations)
  MAY become causal islands. Each has its own trigger surface, params, and event horizon.
  A kumu instance with declared papalohe ports is a natural island candidate.
  Events cross only via papalohe edges. kukali is the yield point inside the island.
  Instance identity provisioned on first papalohe edge declaration, not on kahea invocation.
  Promotion to island is optional; local causality errors correctable inside the node.

Tier 1 — memes inside rooms (within your local Automerge doc window)
  Simultaneously apprehended within your local doc snapshot.
  A room is a filter recipe over the meme graph — not a data partition.
  Rating (≥Meme) gates which room recipes include a meme. Stage band is a rendering annotation only.
  Peer state of the SAME doc is NOT simultaneously apprehended — you see their last sync.

Tier 2 — Automerge Realms (distinct Automerge docs)
  A separate Automerge doc reached from this one — no matter where first encountered.
  ALWAYS non-simultaneously apprehended by topology, not by policy.
  "automerge-realm" and "peer-sync-state" MAY be named causal islands for protocol tracking.

Tier 3 — Lares nodes (the federated layer)
  A federation edge IS a causal island (this law).
  Cross-node sync begins with a boot artifact, then proceeds via offset-resumable deltas.
  Authority graph reconciles before manifest. Manifest reconciles before content.
```

<<~/ahu >>

<<~ ahu #causal-island-doctrine >>

## Causal Island Doctrine

### MAY become causal islands

- rooms, memes, sigils
- kumu instances, kahea invocations (Tier 0 prime candidates)
- local room projections, long-lived runtime actors
- automerge-realm, peer-sync-state (non-simultaneous by topology)

### MUST become causal islands

- node-to-node federation edges
- cross-node pranala connections
- canon-promotion ceremonies
- revocation epoch changes
- encrypted sync membership changes
- any live hostful record proposing hostless canon mutation

Local causality errors can be corrected inside a node.
Cross-node causality errors become federation corruption.

<<~/ahu >>


<<~ ahu #edges >>

<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #to-orichalcum ? -> lar:///ha.ka.ba/api/v0.1/pono/orichalcum-capabilities family:control role:depends >>
<<~ pranala #extends-pranala ? -> lar:///ha.ka.ba/api/v0.1/pono/pranala family:control role:extends >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
