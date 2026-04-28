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
role         = "invariant law: node-to-node pranala connections are causal islands; authority-first sync order; edge-island identity, lifecycle, relay semantics"
cacheable    = true
retain       = true
invariant    = true
```

<<~/ahu >>

<<~&#x0002; ahu #meme-body-open >>
federated-causal-islands opens
<<~/ahu >>

<<~ ahu #law >>

## Law

A node-to-node pranala connection IS a causal island.

It is not a transport. It is not a socket. It is a named, capability-gated causal
boundary between two Lares nodes carrying its own identity, durable offset, stream
log, reconciliation state, visibility predicate, revocation epoch, and receipt history.

A room WebSocket connection is NOT an edge island. A room connection is session-scoped
and ephemeral. An edge island is persistent, named, and authority-bearing.

<<~/ahu >>

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
Tier 1 — kumu instances (inside a carrier)
  Each kahea invocation of a kumu sigil with declared papalohe ports MAY be a causal island.
  Events cross only via papalohe edges. kukali is the yield point inside the island.
  Instance identity provisioned on first papalohe edge declaration, not on kahea invocation.

Tier 2 — memes inside rooms (inside a Lares node)
  A room is a filter recipe over the meme graph — not a data partition.
  A meme is a CRDT document or projection root within the room.
  Rating (≥Meme) gates which room recipes include a meme. Stage band is a rendering annotation only.

Tier 3 — Lares nodes (the federated layer)
  A federation edge IS a causal island (this law).
  Cross-node sync begins with a boot artifact, then proceeds via offset-resumable deltas.
  Authority graph reconciles before manifest. Manifest reconciles before content.
```

<<~/ahu >>

<<~ ahu #causal-island-doctrine >>

## Causal Island Doctrine

### MAY become causal islands

- rooms, memes, sigils, kumu instances, kahea invocations,
  local room projections, long-lived runtime actors

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

<<~&#x0003; ahu #body-close >>
federated-causal-islands closes
<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #to-orichalcum ? -> lar:///ha.ka.ba/api/v0.1/pono/orichalcum-capabilities family:control role:depends >>
<<~ pranala #extends-pranala ? -> lar:///ha.ka.ba/api/v0.1/pono/pranala family:control role:extends >>

<<~/ahu >>

<<~&#x0004; -> ? >>
