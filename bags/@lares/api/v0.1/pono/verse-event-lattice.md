<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~⊙&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/verse-event-lattice >>
```toml iam
uri-path    = "ha.ka.ba/@lares/api/v0.1/pono/verse-event-lattice"
file-path   = "bags/@lares/api/v0.1/pono/verse-event-lattice.md"
type        = "text/x-memetic-wikitext"
register    = "CS"
confidence  = 0.90
mana        = 0.90
manao       = 0.88
manaoio     = 0.86
tagspace    = "stable"
role        = "invariant doctrine: UEFN Verse 5.6 event type lattice — event/listenable asymmetry, suspends effect specifier, @editable boundary, using module import; standard for Lararium device model"
cacheable   = true
retain      = true
invariant   = true
status-date = "2026-05-02"
```

<<~&#x0002;>>

<<~ ahu #head >>

# Verse Event Lattice

UEFN Verse 5.6 defines a four-type event lattice that maps directly onto the
Lararium device model. The core asymmetry — **user code fires events; the engine
vends listens** — is the design invariant that separates kukali (widget dispatch)
from the projection bus (ReactionEngine subscription).

**Source authority:** Verse Language Reference (Epic Games, 2024–2025); local-first.fm
episode 19 (Brooklyn Zelenka) for the peer model alignment.

<<~/ahu >>

<<~ ahu #type-lattice >>

## The Four Types

### signalable(t)

```verse
signalable(t:type) := interface:
    Signal(Payload:t):void
```

A handle with a single capability: fire. No subscription, no await.
Used when one system triggers another without coupling to the response.

**Lararium mapping:** `dispatchEvent({type: "tm-lararium-event", uri, listenable})` from
`KukaliWidget` is a signalable call — fires into the TW5 wiki event bus and returns.

---

### awaitable(t)

```verse
awaitable(t:type) := interface:
    Await()<suspends>:t
```

A handle with a single capability: suspend until a value arrives.
`Await()` is a `<suspends>` callsite — it yields the current fiber cooperatively.

**Critical distinction:** `<suspends>` is an **effect specifier**, not a return type modifier.
It says the function *may* yield the calling fiber; it says nothing about whether the
function returns a value. A function returning `void` can be `<suspends>`.

**Lararium mapping:** `MemeProjection.onChangeset()` is awaitable-shaped —
the caller suspends (or schedules) until the changeset resolves.

---

### subscribable(t)

```verse
subscribable(t:type) := interface:
    Subscribe(Callback:(t):void):cancelable
```

A handle with a single capability: register a persistent callback.
Returns a `cancelable` so the subscriber can unsubscribe.

**Lararium mapping:** `tw5.wiki.addEventListener("change", handler)` follows this
pattern exactly. `ReactionEngine.registerProjectionBus(engine)` returns a teardown
function — the cancelable equivalent.

---

### event(t) — User-Instantiable Compound Type

```verse
event(t:type) := class<final>:
    # implements signalable(t) + awaitable(t)
    Signal(Payload:t):void = ...
    Await()<suspends>:t = ...
```

The *user-instantiable* event type. Code creates `event(t)` instances with `event(t){}`.
It combines signalable + awaitable: a producer can `.Signal()` it;
a consumer can `.Await()` it within a `<suspends>` context.

Crucially: **no `Subscribe()`**. Persistent multi-consumer callbacks are not
available on user-instantiated events. Only the engine may vend `listenable`.

**Lararium mapping:** a KukaliWidget event is an `event(t)` — the widget fires it
(signalable); the ReactionEngine awaits it (awaitable) in a reaction fiber.

---

### listenable(t) — Engine-Vended Only

```verse
listenable(t:type) := interface:
    # implements awaitable(t) + subscribable(t)
    Await()<suspends>:t = ...
    Subscribe(Callback:(t):void):cancelable = ...
```

The persistent subscription type. Only the **engine** vends `listenable` handles.
User code receives them; user code does not create them.

This is the design-boundary invariant: if you can `Subscribe()` to it, the engine
controls its lifecycle. If you can only `Await()` it, you are in a fiber.

**Lararium mapping:** the `listenable` field on `ReactionBinding` is an engine-vended
handle. `ReactionEngine` holds `listenable` references and subscribes to them
(`tw5.wiki.addEventListener` is the `Subscribe()` equivalent in the TW5 host).

<<~/ahu >>

<<~ ahu #suspends >>

## `<suspends>` — Effect Specifier

`<suspends>` is not a return type. It is an **effect annotation** on a function or
expression that declares: "this callsite may suspend the current logical task."

```verse
# Correct reading: Task may yield here; result is type t
SomeFunc()<suspends>:t

# Common misreading (WRONG mental model):
# "suspends" modifies the return — it does not
```

### Rules

1. A function annotated `<suspends>` may only be called from within a `<suspends>` context
   or from a `spawn` expression (which creates a new fiber).
2. `<suspends>` propagates upward: calling a `<suspends>` function from a non-suspends
   function requires marking the caller `<suspends>`.
3. Fibers are cooperative: the runtime suspends at `Await()` callsites only.
   No preemptive suspension.

### Lararium consequence

`MemeProjection.onChangeset()` is typed `async` (TypeScript equivalent of `<suspends>`).
Any sync path that calls it MUST be made async or moved to a scheduled microtask.
The MemeSyncAdaptor properly awaits it inside an async wrapper — this is correct.

<<~/ahu >>

<<~ ahu #simulation-types >>

## `agent` and `player` — Simulation Participant Types

From `/Verse.org/Simulation` module. These function as **class-level types**, not interfaces.

- **`agent`** — the universal participant supertype. Covers all live entities: session-connected participants (`player` subtype) AND non-player entities (generic wiki entities, NPCs, scripted actors). `game_action_instigator` gets implemented by "player or agents" — confirming agent as the general case.
- **`player`** — the session-connected subtype. A `player` holds a live connection to the current session; a non-player `agent` does not. NOT limited to humans — anything with a live session link qualifies as a `player` in Verse type terms.
- **`session`** — one instance per round. `GetSession()` returns the current round's session.
- **`team`** — grouping of agents.

**Why events use `listenable(agent)` rather than `listenable(player)`:** The entering entity may qualify as a non-player wiki entity, not a session-connected participant. `agent` serves as the correct general-case payload type; `listenable(player)` would exclude all non-player entities.

**Lararium mapping:**
- Verse `agent` → **`lar_agent`**: supertype for all addressable live entities on the wiki canvas. **Identity splits here:** player-class subtypes (Operator, Guest, `lares-daemon`) carry a Keyhive principal identity; Wiki Entities / NPCs (non-player `agent` subtypes) do not.
- Verse `player` *(human)* → **Operator / Guest**: human session-connected participant with Keyhive identity. Operator = primary human principal (threshold relation). Guest = invited, limited cap.
- Verse `player` *(system)* → **`lares-daemon`**: session-connected AI coordinator(s) with Keyhive identity. Verse class = `player`. Lares class = system principal with additional authority (admin doc, Session RE, Keyhive system keypair). May run multiple per session.
- Verse `agent` *(non-player)* → **Wiki Entity / NPC**: not session-connected; no Keyhive identity. Reactive wiki entities — they carry a `lar_character` tiddler and respond to RE reactions, but hold no principal. Interactive characters, scripted actors, game NPCs. Population open-ended.
- Verse `session` → **Lares Session Wiki**: the coordinator `lar_playspace` for the round; pinned-hot. A session hosts N `lar_playspace` wikis; the Session Wiki coordinates them (broadest recipe, owns the session event-bus bag).
- Verse `fort_character` → **`lar_character`**: tiddler representing an Agent's embodied presence on the canvas. Position, state, event pins.

The compound type `listenable(agent)` functions as the canonical event type for **any participant action** in both Verse and Lares. Device events parameterized on `agent` do NOT restrict to human players.

<<~/ahu >>

<<~ ahu #editable >>

## `@editable` — Design/Logic Boundary

In Verse, `@editable` marks a property as configurable in the UEFN editor UI.
It is the **design boundary**: above `@editable` is visual/authoring-time configuration;
below is runtime logic.

```verse
my_device := class(creative_prop):
    @editable
    OnPlayerEnters:listenable(agent) = player_spawner_device.PlayerSpawnedEvent

    @editable
    TargetUri:string = "lar:///ha.ka.ba/@lares/api/v0.1/lararium/home"
```

**Lararium alignment:**

The `@editable` boundary maps onto the distinction between:
- **React props / TW5 widget attributes** (authoring-time; editable in the editor)
- **ReactionEngine subscriptions** (runtime; wired at boot)

A `KukaliWidget` accepts its `uri` and `listenable` attributes as props — these are
the `@editable` surface. The internal `dispatchEvent` call is the runtime logic.

**Rule:** Any URI or event handle that a device exposes to the room author is an
`@editable`-equivalent. It MUST NOT be hardcoded in the runtime logic.

<<~/ahu >>

<<~ ahu #using >>

## `using` — Module Import, Not Trait Composition

```verse
using { /Verse.org/Verse }
using { /EpicGames/Devices }
```

`using` in Verse is a **module namespace import**. It brings exported identifiers
into scope from a module path. It has no relation to trait bounds, mixins, or
interface composition.

**Common confusion:** developers from Rust/Haskell backgrounds read `using` as
`impl Trait for Type` or `derive`. It is not. It is closer to Python's
`from module import *` scoped to a namespace path.

**Lararium implication:** When Verse code is cited in Lararium architecture docs as
justification for an interface design, `using` lines are module imports — not
statements about structural subtyping. The type lattice (signalable/awaitable/
subscribable/event/listenable) is the structural system; `using` is how you
access it from a given file.

<<~/ahu >>

<<~ ahu #lararium-device-model >>

## Lararium Device Model Alignment

A `KukaliWidget` is a Verse creative_prop equivalent:

| Verse concept | Lararium equivalent |
|---|---|
| `creative_prop` | `KukaliWidget` (TW5 widget subclass) |
| `@editable` property | React prop / TW5 widget attribute |
| `event(t){}` instantiation | `dispatchEvent({type: "tm-lararium-event", ...})` |
| `listenable` (engine-vended) | `tw5.wiki.addEventListener("change", ...)` |
| `spawn { device.OnEvent.Await() }` | ReactionEngine fiber registered via `registerProjectionBus()` |
| `cancelable` from `Subscribe()` | teardown function returned by `registerProjectionBus()` |

**The KukaliWidget loop:**

```
1. Widget renders with uri + listenable props     (@editable boundary)
2. User interacts → widget calls dispatchEvent    (signalable: fires event)
3. TW5 wiki bus carries the event                 (causal island interior)
4. ReactionEngine.handleEvent() receives it       (subscribable: persistent callback)
5. ReactionEngine resolves the projection         (awaitable: async onChangeset)
6. MemeProjection.onChangeset() updates store     (<suspends>: cooperative fiber)
7. MemeSyncAdaptor pushes tiddlers into TW5       (closes the loop)
```

Step 4 exists only because `registerProjectionBus()` wired the subscribable side.
Without it, the event fires and nobody hears it — the fiber is never spawned.

**Law:** `KukaliWidget` MUST use `dispatchEvent` (signalable). `ReactionEngine` MUST
subscribe via `registerProjectionBus` (subscribable). These are never the same call.
The asymmetry is the point.

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #to-vm-projection-bus ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/vm-projection-bus family:relation >>
<<~ pranala #to-causal-islands ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/causal-islands family:relation >>
<<~ pranala #to-local-first ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/local-first family:relation >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
