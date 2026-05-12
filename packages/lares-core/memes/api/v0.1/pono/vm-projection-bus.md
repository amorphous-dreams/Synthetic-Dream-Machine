<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~⊙&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/vm-projection-bus >>
```toml iam
uri-path    = "ha.ka.ba/@lares/api/v0.1/pono/vm-projection-bus"
file-path   = "packages/lares-core/memes/api/v0.1/pono/vm-projection-bus.md"
type        = "text/x-memetic-wikitext"
register    = "CS"
confidence  = 0.90
mana        = 0.90
manao       = 0.88
manaoio     = 0.86
tagspace    = "invariant"
role        = "invariant doctrine: VmPool→Projection Messaging Standard; dispatchEvent/addEventListener pattern; TW5Engine.registerProjectionBus design; replaces _larKukaliHook"
cacheable   = true
retain      = true
invariant   = true
status-date = "2026-05-02"
```

<<~&#x0002;>>

<<~ ahu #head >>

# VM Pool → Projection Messaging Bus

The projection bus is the coupling between the TW5 VM (widget tree, render events)
and the ReactionEngine (CRDT projection, meme store mutations). It replaces the
`_larKukaliHook` singleton with a Verse-aligned `signalable`/`subscribable`
asymmetry baked into the TW5 wiki event system.

**Law:** TW5Engine does not know about ReactionEngine. ReactionEngine registers
itself onto TW5Engine at runtime. The direction of dependency is:
`ReactionEngine → TW5Engine`, never the reverse.

<<~/ahu >>

<<~ ahu #event-contract >>

## Event Contract

### Signal side (KukaliWidget fires)

```typescript
// KukaliWidget.ts — inside the TW5 widget's invokeAction or handleEvent
this.wiki.dispatchEvent({
  type: "tm-lararium-event",
  uri: this.getAttribute("uri"),
  listenable: this.getAttribute("listenable"),
});
```

`this.wiki.dispatchEvent(event)` is TW5's native event bus — it broadcasts to all
listeners registered via `wiki.addEventListener()`. This is the signalable side.

The shape of the event object is the contract. All fields are strings.
`uri` identifies the meme target. `listenable` names the projection slot.

### Subscribe side (ReactionEngine listens)

```typescript
// TW5Engine.ts
registerProjectionBus(engine: ProjectionBusConsumer): () => void {
  const handler = (event: LarariumWikiEvent) => {
    engine.handleLarariumEvent(event.uri, event.listenable);
  };
  this.wiki.addEventListener("tm-lararium-event", handler);
  return () => this.wiki.removeEventListener("tm-lararium-event", handler);
}
```

Returns a teardown function — the `cancelable` equivalent from Verse's `Subscribe()`.
The caller (VmPool or LarariumShell) holds the teardown and calls it on dispose.

### ProjectionBusConsumer interface

```typescript
interface ProjectionBusConsumer {
  handleLarariumEvent(uri: string, listenable: string): void;
}
```

`ReactionEngine` implements this. `TW5Engine` depends only on this interface — never
on `ReactionEngine` directly. The interface is defined in `@lararium/core`.

<<~/ahu >>

<<~ ahu #vm-pool-wiring >>

## VmPool Wiring

Each VM slot in the pool has its own `TW5Engine` instance. The pool wires the
projection bus when a slot is activated:

```typescript
// VmPool.ts — conceptual
class VmPool {
  private teardowns: Map<number, () => void> = new Map();

  activateSlot(slot: number, engine: TW5Engine, projBus: ProjectionBusConsumer): void {
    const teardown = engine.registerProjectionBus(projBus);
    this.teardowns.set(slot, teardown);
  }

  deactivateSlot(slot: number): void {
    this.teardowns.get(slot)?.();
    this.teardowns.delete(slot);
  }
}
```

**Slot 0** = local room (always active).
**Slot N** = foreign realm projection (activated on cross-realm sync request).

Each slot has an independent projection bus wire. A kukali event in slot 0 does not
propagate to slot 1 — the wiki event buses are per-VM, not shared.

<<~/ahu >>

<<~ ahu #migration-from-hook >>

## Migration from `_larKukaliHook`

The old pattern:

```typescript
// ✗ web2 pattern — global singleton, reverse dependency
TW5Engine._larKukaliHook = (uri, trigger) => {
  reactionEngine.handleKukali(uri, trigger);
};
```

Problems with this pattern:
1. Global mutable state — breaks with multiple VMs in the pool
2. Reverse dependency direction — TW5Engine references ReactionEngine type
3. Not isomorphic — browser and node had different hook installation sites
4. Non-cancellable — no teardown path; leaked on VM disposal

The replacement:

```typescript
// ✓ web3 pattern — per-VM registration, correct dependency direction
const teardown = vm.registerProjectionBus(reactionEngine);
// ... later, on pool slot deactivation:
teardown();
```

**MUST:** `_larKukaliHook` MUST NOT exist in any non-web2 file.
Any file referencing `_larKukaliHook` outside a `*.web2.*` path FAILS FPI-1.

<<~/ahu >>

<<~ ahu #verse-alignment >>

## Verse Alignment

| Verse pattern | Lararium equivalent |
|---|---|
| `event(t){}` instance on device | `{type: "tm-lararium-event", uri, listenable}` object |
| `device.MyEvent.Signal(payload)` | `wiki.dispatchEvent(event)` |
| `device.MyEvent.Await()` in fiber | `handleLarariumEvent()` in reaction handler |
| `device.ListenableEvent.Subscribe(cb)` | `wiki.addEventListener("tm-lararium-event", handler)` |
| `cancelable` from `Subscribe()` | `() => void` teardown from `registerProjectionBus()` |
| `@editable OnSomeEvent:listenable` | Widget `listenable` attribute (prop-configured) |

The asymmetry is preserved:
- KukaliWidget signals (fires) — knows nothing about who is listening
- ReactionEngine subscribes (persists) — knows nothing about which widget fired

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #to-verse-event-lattice ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/verse-event-lattice family:relation >>
<<~ pranala #to-causal-islands ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/causal-islands family:relation >>
<<~ pranala #to-local-first ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/local-first family:relation >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
