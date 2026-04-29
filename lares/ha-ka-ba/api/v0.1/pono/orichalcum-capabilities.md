<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/pono/orichalcum-capabilities >>

<<~ ahu #iam >>

```toml
uri-path     = "ha.ka.ba/api/v0.1/pono/orichalcum-capabilities"
file-path    = "lares/ha-ka-ba/api/v0.1/pono/orichalcum-capabilities.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "invariant"
confidence   = 0.80
register     = "CS"
manaoio      = 0.78
mana         = 0.82
manao        = 0.80
role         = "invariant law: Orichalcum capability profile — UCAN-compatible at wire boundary, Lararium-native semantic caveats; authority-gate law for rooms, edge islands, and canon promotion"
cacheable    = true
retain       = true
invariant    = true
```

<<~/ahu >>


<<~ ahu #law >>

## Law

An Orichalcum capability answers five questions:

1. **Who grants?** `issuer` — a `LarPrincipal`
2. **Who receives?** `audience` — a `LarPrincipal`
3. **What resource?** `resource` — a `lar:///` canonical URI or `edge:` island id
4. **What actions?** `abilities` — one or more from the ability ladder (see below)
5. **Under what Lararium truth conditions?** `caveats` — Lararium-native predicates

A cryptographically valid UCAN-shaped proof that fails any Lararium caveat is NOT authorized.
Crypto validity is necessary but not sufficient. Semantic validity requires caveat passage.
Authority travels with the graph. Authority MUST NOT be outsourced to crypto alone.

<<~/ahu >>

<<~&#x0002;>>


<<~ ahu #principal >>

## Principal Shapes

```toml
[[principal_kinds]]
kind        = "did"
description = "W3C DID — external identity, UCAN-compatible"

[[principal_kinds]]
kind        = "ed25519"
description = "raw Ed25519 public key — device-level identity"

[[principal_kinds]]
kind        = "local-operator"
fields      = ["alias", "tier", "host"]
description = "local trust alias — bootstrap identity before full DID ceremony"
```

A person is modeled as a group of device principals.
A room, meme, or edge island may itself act as a group principal with its own access graph.
These are not the same object. Keep device identity below operator identity.

<<~/ahu >>

<<~ ahu #ability-ladder >>

## Ability Ladder

```
pull     — retrieve encrypted bytes; relay without reading
           pull does NOT imply read — this is the relay-law exception
read     — decrypt and render semantic content
sync     — participate in reconciliation
write    — produce accepted mutations
propose  — suggest hostful changes (pending; not yet hostless canon)
promote  — hostful → hostless canon-promotion ceremony
admin    — manage room, recipe, edge island membership
revoke   — roll epoch; terminate future live tail for a principal
```

Each ability implies all abilities below it in this ladder, EXCEPT:
`pull` does not imply `read`. A relay may hold `pull` without `read`.

<<~/ahu >>

<<~ ahu #caveats >>

## Lararium Caveats

Caveats are Lararium-native predicates evaluated at gate time.
A capability with no caveats is a maximally permissive grant within its ability scope.
Rating band names are Law-of-Fives structural buckets. Stage band is a UX/rendering annotation — it is NOT a capability gate condition.

### Rating Caveat (structural quality — Law of Fives)

```toml
[[caveats]]
kind    = "rating-at-least"
values  = ["Noise", "Data", "Meme", "Ano", "Kapu"]
note    = """
  Five structural buckets from pono/meme rating posture.
  Noise: raw signal, not machine-usable.
  Data: structure visible, meme law does not yet bind.
  Meme: lawful memetic shape holds; minimum for federation.
  Ano: one or more outward type laws bind the carrier.
  Kapu: invariant kernel; cannot be overridden by lower tiers.
"""
```

A carrier below `Meme` rating MUST NOT federate.
Noise and Data are node-local only.

### Manaoio Caveat (believability weight)

```toml
[[caveats]]
kind    = "manaoio-at-least"
type    = "number [0.0–1.0]"
note    = """
  Community-weighted believability. Distinct from confidence (operator-set).
  Three separate thresholds: read / propose / promote.
  Default: 0.0 / 0.60 / 0.80.
"""
```

### Scope and Boundary Caveats

```toml
[[caveats]]
kind    = "room-recipe"
type    = "lar:/// URI — meme must satisfy this recipe's filter"

[[caveats]]
kind    = "kapu-scope"
values  = ["personal", "consensual", "collective", "universal"]
note    = "maps to SCOPE_5 / LADDER_5 social scope; capability valid only within this level"

[[caveats]]
kind    = "host-boundary"
values  = ["hostless-only", "hostful-ok"]
note    = "hostless-only: capability does not extend to live session records"

[[caveats]]
kind    = "edge-island"
type    = "edge: island id"
note    = "capability scoped to one specific edge island"

[[caveats]]
kind    = "epoch"
type    = "epoch string"
note    = "capability invalid after this epoch string; rolls with revocation"
```

### Federation Defaults (operator-configurable per room recipe)

```toml
[federation_defaults]
# Structural gate — rating ladder
min_rating_federate  = "Meme"   # Noise and Data are node-local only

# Believability gate — manaoio scalar
min_manaoio_read     = 0.0
min_manaoio_propose  = 0.60
min_manaoio_promote  = 0.80

# Stage band is a UX/rendering annotation only.
# Room recipes MAY include stage-based filter predicates as operator configuration,
# but stage is not a hardcoded capability gate condition.
```

<<~/ahu >>

<<~ ahu #gate-points >>

## Capability Gate Points

A capability MUST be evaluated at these transitions — not deferred:

```
1. room join         — before handleSocketConnect
2. boot receipt emit — before sending the join snapshot
3. edge-island open  — before stream handshake
4. per-delta accept  — capability must still be valid at delta receipt time
5. promotion propose — before a hostful record enters the promotion queue
6. epoch rollover    — before any new live-tail frames are issued
```

Gate failures at steps 1–3 close the connection.
Gate failures at step 4 drop the delta frame and log a receipt violation.
Gate failures at steps 5–6 reject the operation and emit a refusal receipt.

<<~/ahu >>

<<~ ahu #documents-as-groups >>

## Documents as Groups

A room, meme, recipe, edge island, or canon-promotion ceremony
MAY act as an authority-bearing group with its own access graph.

This means:

```
lar:///rooms/the-altar-fire
  members:
    admin group   → promote + admin
    operator group → read + sync + propose
    public group  → read (visible public layer only)

lar:///memes/ha.ka.ba/pono/some-meme
  members:
    admin group   → write + promote
    operator group → read + sync + propose

edge:nodeA:nodeB:altar-fire:epoch42
  members:
    nodeA device key → sync + pull
    nodeB device key → sync + pull
    relay principal  → pull only
```

No global ACL owns these. Authority travels with the graph. Each object owns its own.

<<~/ahu >>

<<~ ahu #ucan-posture >>

## UCAN Posture

```
UCAN principles:        consume now
UCAN wire envelope:     design for now
                        (issuer / audience / resource / ability / caveat / proof / expiry)
UCAN hard dependency:   defer until after proof fixture + semantic alignment audit
Lararium authority:     Orichalcum Profile governs — not UCAN alone
```

UCAN is the external proof shape. Orichalcum is the semantic law.

Build adapters so a Lararium capability can emit and verify a UCAN wire proof.
Do not let UCAN wire validity become the internal source of truth for Lararium authority.

A cryptographically valid UCAN that fails a Lararium caveat (rating, manaoio,
kapu-scope, epoch) is not authorized. The caveat gate fires after
the crypto gate, not instead of it.

<<~/ahu >>


<<~ ahu #edges >>

<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #required-by-federation ? -> lar:///ha.ka.ba/api/v0.1/pono/federated-causal-islands family:control role:required-by >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
