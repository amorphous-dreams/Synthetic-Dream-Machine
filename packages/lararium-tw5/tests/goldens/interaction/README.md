# Interaction goldens — scripts of acts over a frozen world

One file per script, `NN-<family>-<name>.json`, each pinning one loss `dreamdom#/conformance` names.
A script speaks the contract's vocabulary and never a DOM API, so one file runs on every harness: the
engine harness (vitest over the fake document and a recording sink), the page harness (vitest in Chromium
over the real sink with the script's frames), and a whole-road harness (Playwright over a staged vessel). The whole road runs golden 01
(`packages/lararium-web/tests/e2e/golden-whole-road.e2e.test.ts`): it reads the golden's world and claims, makes the
tiddlers through the page's editor and acts with a real mouse, so it asserts the page template's river (a followed link
opens below its source) where the bare-navigator world of the two other harnesses puts it on top. Goldens 02 to 13 stand
owed on this road.

```
{
  "golden":  "lar:///ha.ka.ba/lares/docs/pono/dreamdom#/conformance/interaction/<n>",
  "pins":    "the loss this script pins, in the carrier's words",
  "world":   { "tiddlers": [...], "story": [...], "root": "<wikitext of the root template>" },
  "surfaces": { "<id>": { "world": ... } }          // a script over more than one surface
  "steps":   [ step, ... ]
}
```

Steps, each one object with one verb:

| verb | carries | meaning |
|---|---|---|
| `frame` | `"first"` or `"next"` | the harness delivers the mount's first frame, or the next frame the island emits |
| `deliver` | `"older"` | the harness delivers a frame the island rendered BEFORE the last sense (its `sensedRevision` for that control reads lower) |
| `sense` | `control`, `wholeValue`, `localRev`, `kind?` | a `lar:control-event` of kind `lar:sense` (droppable: newest wins, no answer) |
| `act` | `control`, `action`, `wholeValue?`, `controlType?`, `selection?`, `localRev?`, `modifiers?`, `key?`, `geometry?`, `epoch?` | a `lar:control-event` of kind `lar:act` (reliable: answered); `epoch: "stale"` carries the previous mount epoch; a toolbar act (`lar:edit-operation`) carries the field's whole value and `selection` as of the act; a `wholeValue` reading `<oversize: N bytes>` stands for N bytes |
| `write` | `records`, `txId` | a whole-record write landing in the store from a peer (the harness lands it through the island's own landing door) |
| `service-result` | `requestId`, `status` | the page's answer to a `lar:service` ask |
| `switch` | `surface` | the vessel moves its gate to another surface; the island receives `lar:resend` |
| `page` | `control`, then one of `composition: "start"` or `"end"` (+ `value`), `input` (+ `composing`), `keydown` (a raw key chord with `isComposing`) | a raw page gesture the page harness performs on the real control; the engine harness relays what the page contract says the page relays for it (a composition's end as one `lar:sense`, a keydown the IME holds as nothing, any other keydown as one `lar:key` act) |
| `wake` | `surface` | the harness wakes a sleeping actor (D4) |
| `expect` | `answers?`, `writes?`, `messages?`, `services?`, `want?`, `frame?`, `page?`, `refused?` | the harness reads: the answers since the last expect (`applied`, `stale-target`, or `refused:<reason>`), the records written (after the echo lands; `tombstone: true` for a deletion), the `tm-*` messages the root widget saw, the `lar:service` asks the engine made, the `want` an answer carried, the next keyed frame (`contains`, `stamps` per selector (each named stamp carries every token the script names; `null` names an absent stamp), `attributes` per selector with `null` for absent, `keys`, `sensedRevision`, `questions`, `questionSubject`, `alert`, `surface`, `epoch: "fresh"`), the page's state per selector (`value`, `undoDepth`, `focus`, `relays`, `relayed`, `relayedSenses`, `relayedActs`, `defaultPrevented`, `refusal`, `visible`, `placedFrom`, `newerVersion`, `state`, `affordances`, and `surface` for the shown surface), or `{"refused": "<reason>"}` where the surface has no road |

A world may carry a `manifest` naming the service kinds the surface carries; the harness opens the surface
with it (`lar:resend{manifest}`), and a world without one carries `LAR_SURFACE_DEFAULT_SERVICES`. `lar:document`
names the page's document leg as a control, and a `service-result` crosses on it; `requestId: "last"` names the
latest service ask. An expected service matches its `kind` and every `args` field the script names; a field the
script leaves unnamed (the rendered text of a download, say) never reads. The page harness reads `services` as
the doors the page opened.

A control names itself by `data-control-id`, by a CSS class the script's root template sets, or by
`tag.class`, read off the frame the harness last delivered. An act names the control's own render id, or
its nearest painted ancestor's: the camera's top element carries one, so every act has a node to climb
from. On the page, a real act that no binding's `data-lar-on` claims relays nothing and leaves the
browser's default standing; the page half reads that as the answer `refused:unclaimed`, the word the
engine half hears for the same act. A surface with no road for a step records `{"refused": ...}`
and the harness checks the refusal reads beside the control in the words of `page-controls#/refusals`.

Every run pins a TW5 commit (`ea94ca8`, the 5.5.0-prerelease fork). A drifting frame hash names a
disagreement, never a content edit.
