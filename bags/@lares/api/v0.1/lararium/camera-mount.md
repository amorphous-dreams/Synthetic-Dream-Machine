<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/camera-mount >>
```toml iam
uri-path    = "ha.ka.ba/@lares/api/v0.1/lararium/camera-mount"
file-path   = "bags/@lares/api/v0.1/lararium/camera-mount.md"
type        = "text/x-typescript"
register    = "CS"
confidence  = 0.89
mana        = 0.88
manao       = 0.86
manaoio     = 0.84
role        = "parse→widget→fakeDOM chain spec per camera — pairs with CameraRegistration for the full camera contract"
cacheable   = true
retain      = true
source-file = "packages/lararium-tw5/src/tw5-vm.ts"
docs        = "lar:///ha.ka.ba/@lares/docs/lararium/verse-mesh"
```

# CameraMount — Invariant

## Identity

`CameraMount` specifies the static structure of one camera:
the parse tree → widget tree → fake DOM chain that TW5 runs per view frustum.

It pairs with `CameraRegistration` to form the full camera contract:

| Concern | Owner |
|---|---|
| Static structure — parse + widget + fake DOM | `CameraMount` / `mountCamera()` |
| Dynamic timing — drain + transact + refresh | `CameraRegistration` / `startRenderLoop()` |

These two concerns stay separate.
`mountCamera` constructs the tree once at camera birth.
`startRenderLoop` drives the tick loop for the camera's lifetime.

## Three-Tree Chain

Each camera runs an independent three-tree chain over the shared wiki:

```
wikitext source
    ↓  wiki.parseTiddler() / wiki.makeTranscludeWidget()
parse tree  (ParseTreeNode[])
    ↓  widget.makeChildWidgets()
widget tree (Widget graph, bound to document)
    ↓  widget.render(container, null)
fake DOM    (TW5FakeElement tree)
    ↓  serialize / hydrate / paint
rendered output
```

`wiki.makeTranscludeWidget(rootTiddler, { document, parentWidget })` constructs
the widget tree and binds it to a `document` (fake DOM target).
Multiple cameras on the same VM slot each receive a distinct `document` instance —
render surfaces stay separate; the wiki world graph stays shared.

## API

```typescript
interface CameraMount {
  /** Root tiddler for this camera's parse + widget tree. */
  rootTiddler: string;
  /** The fake DOM document this camera renders into. */
  document: Document | TW5FakeDocument;
  /** The container element this camera renders into. */
  container: TW5FakeElement | HTMLElement;
}

// On TW5Engine:
mountCamera(mount: CameraMount): () => void
```

Returns a teardown function.  Caller pairs with `CameraRegistration.accumulator`
in `startRenderLoop` to complete the camera.

## Invariants

**C-1 Structural separation.**
`mountCamera` wires the static chain (parse → widget → fake DOM) once.
It does not manage tick timing or accumulator drain.
Callers do not mix mount and loop concerns in one call.

**C-2 One document per camera.**
Each camera receives its own `document` instance.
Cameras do not share fake DOM trees.
The TW5 wiki (world graph) remains shared — only the render surface separates.

**C-3 View frustum in root tiddler.**
The root tiddler's wikitext body defines the view frustum
(e.g. `<$list filter="[tag[...]]">` or a transclusion of a story-list tiddler).
The accumulator carries no filter — the widget tree's dependency graph handles
selective refresh after each `wiki.transact()`.

**C-4 Change listener owned by mountCamera.**
`mountCamera` registers `wiki.addEventListener("change", widgetTree.refresh)`.
The teardown function removes this listener.
The `startRenderLoop` teardown cancels timers; `mountCamera` teardown removes
the listener and detaches DOM nodes.  Callers invoke both.

**C-5 Input path — no new machinery.**
Cameras that accept user input dispatch events through the widget tree's standard
TW5 event bus (`widget.dispatchEvent`).  Events travel up to the root widget.
`reaction-router.ts` catches `tm-verse-event`; `IslandAdaptor.saveTiddler` handles
outbound writes.  The input path stays identical across all cameras.

## Full Camera Wiring

```typescript
// Mount the parse→widget→fakeDOM chain:
const teardownMount = tw5.mountCamera({
  rootTiddler: "lar:///ha.ka.ba/camera/tldraw-root",
  document:    tlDrawFakeDoc,
  container:   canvasRootElement,
});

// Drive the drain→transact→change→refresh cycle:
const teardownLoop = tw5.startRenderLoop(
  [{ accumulator: canvasAcc, tickMs: 16, budget: 200 }],
  adaptor,
);

// Teardown both on camera unmount:
const unmount = () => { teardownLoop(); teardownMount(); };
```

## Platform Fake DOM Targets

| Camera surface | `document` type |
|---|---|
| Story River (browser) | `window.document` |
| TLDraw canvas (browser) | `OffscreenCanvas`-backed custom doc |
| Node SSR | `$tw.fakeDocument` |
| Mobile native | platform fake doc (React Native bridge) |
| Headless / MCP | `$tw.fakeDocument` or null render |

The `mountCamera` interface stays identical across platforms.
The `document` type changes; the widget tree and fake DOM chain do not.

<<~&#x0002;>>

<<~&#x0004; -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/island-accumulator >>
<<~&#x0004; -> lar:///ha.ka.ba/@lares/docs/lararium/verse-mesh >>
