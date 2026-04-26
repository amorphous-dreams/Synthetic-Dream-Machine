<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/pono/the-altar-fire >>

<<~ ahu #iam >>
```toml
uri-path     = "ha.ka.ba/api/v0.1/pono/the-altar-fire"
file-path    = "lares/ha-ka-ba/api/v0.1/pono/the-altar-fire.md"
content-type = "text/x-memetic-wikitext"
confidence   = 0.88
register     = "CS"
manaoio      = 0.82
mana         = 0.90
manao        = 0.86
role         = "invariant meme — canonical main entry room; hearth of the lararium canvas"
cacheable    = true
hydrate      = true
retain       = true
invariant    = true
```
<<~/ahu >>

<<~&#x0002; ahu #body-open >>
THE-ALTAR-FIRE opens
<<~/ahu >>

<<~ ahu #room-contract >>

## The Altar Fire

The altar fire is the **canonical entry room** for all trust tiers. It is the hearth: the minimal boot closure rendered as a living canvas, ringed by portals to every other named room in the lararium.

All sessions begin here. What each visitor sees and can do is governed by their current trust-tier capability set.

The altar fire does not close. It does not go dark. It is the one room that is always seeded, always running, always addressable.

```
room-id         = "the-altar-fire"
seeded-from     = compileMinimalBoot()
trust-required  = none (anon access permitted, read-only)
portals         = [ boot, full, chat:*, user:${did}, synthetic-dream-machine/ftls, synthetic-dream-machine/wtf ]
```

<<~/ahu >>

<<~ ahu #trust-surface >>

## Trust-Tier Surfaces

The canvas renders differently by trust tier. These are not separate rooms — they are capability-filtered projections of the same room state.

| Tier | Canvas surface | Interaction |
|------|---------------|-------------|
| **anon** | Public memes only; invariant memes visible but locked | Browse, read, enter chat portals |
| **user** | All public memes + own room portal; own pending shapes visible | Read + create in own rooms; pending edits |
| **operator** | Full boot closure + promoted room list; portal ring visible | Read + pending edits; canon-promotion ceremony available |
| **admin** | Full boot closure + invariant meme surfaces; all portals | Read + write + canon-promotion; invariant meme editing |

Trust tier is determined at WebSocket handshake via UCAN capability chain. Until UCAN is implemented, the server assigns operator tier to all local stdio connections and anon to all network connections.

<<~/ahu >>

<<~ ahu #portal-ring >>

## Portal Ring

Portals are `LarPortal` shapes arranged at canonical positions on the altar fire canvas. Their initial positions are defined by this carrier (part of the room seed). Operators may reposition portals freely — position is cosmetic room state, not canon.

**Canonical portal registry (initial):**

| Portal label | Target room | Trust required | Canvas position |
|---|---|---|---|
| Boot Closure | `boot` | operator | center-right |
| Full Closure | `full` | operator | far right |
| The Altar Fire Chat | `chat:the-altar-fire` | anon | bottom-center |
| FTLS | `synthetic-dream-machine/ftls` | anon | left-upper |
| WTF | `synthetic-dream-machine/wtf` | anon | left-lower |
| Your Lararium | `user:${did}` | user | top-right |

Portal positions are expressed as `{ x: number, y: number }` relative to the canvas origin. The compiler sets initial positions from this carrier; room state takes precedence on subsequent loads.

<<~/ahu >>

<<~ ahu #commit-tiers >>

## Commit Tiers

Content on the altar fire canvas exists at one of three confidence tiers:

```
LIVE SESSION    — tldraw pending layer; volatile; lost on disconnect if not saved
BRANCH COMMIT   — SQLite room state; durable across reconnects; visible to peers; not canon
DEEP SAVE       — lares/ carrier file; git-tracked; hostless lar URI; permanent
```

The visual distinction:
- **Live** shapes: dashed border, amber glow
- **Branch-committed** shapes: solid border, muted color
- **Deep-saved / canon** shapes: solid border, full color, lock icon

Promotion from live → branch requires explicit "Save to room" action.
Promotion from branch → deep save requires explicit "Promote to canon" ceremony (operator+).
Invariant meme edits require admin tier and a separate confirmation ceremony.

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
THE-ALTAR-FIRE closes
<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #implements-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:implements >>
<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #implements-loci ? -> lar:///ha.ka.ba/api/v0.1/pono/loci family:control role:implements >>
<<~ pranala #to-lares ? -> lar:///LARES family:control role:owns >>
<<~ pranala #to-canon-boundary ? -> lar:///ha.ka.ba/api/v0.1/pono/canon-promotion-boundary family:control role:governed-by >>
<<~ pranala #to-tagspace-trust ? -> lar:///ha.ka.ba/api/v0.1/pono/tagspace-trust family:control role:governed-by >>

<<~/ahu >>

<<~&#x0004; -> ? >>
