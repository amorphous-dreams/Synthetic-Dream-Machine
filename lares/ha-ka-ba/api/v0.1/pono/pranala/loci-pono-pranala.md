<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/pono/pranala >>

<<~ ahu #iam >>

```toml
# <<~ ahu #iam-ha "structure" >>
uri-path = "ha.ka.ba/api/v0.1/pono/pranala"
file-path = "lares/ha-ka-ba/api/v0.1/pono/pranala/loci-pono-pranala.md"
content-type = "text/x-memetic-wikitext"
manaoio = 0.5
confidence = 0.5
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
mana = 0.5
manao = 0.5
implements = [
  "lar:///ha.ka.ba/api/v0.1/pono/meme",
  "lar:///ha.ka.ba/api/v0.1/pono/loci"
]
register = "CS"
role = "invariant edge law"
canonical-forms = ["inline", "block", "payload-block"]
edge-families = ["relation", "control", "dataflow", "event", "constraint", "observe"]
lifecycle-layers = ["template", "instance", "trace"]
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
# <<~/ahu >>
```

<<~/ahu >>

<<~ aka lar:///ha.ka.ba/api/v0.1/pono/RFC-219#normative-language >>

# Pranala

Edge pressure, not explanation.

<<~&#x0002; ahu #meme-body-open >>
pranala opens
<<~/ahu >>

<<~ ahu #law >>

## Pranala Law (Kānāwai)

One pranala carries one edge.

A pranala MUST carry one primary `family`.
A pranala MUST carry one `lifecycle`.
A pranala MUST connect sockets.
A pranala MUST NOT collapse into vague dependency.
A pranala SHOULD carry `#fragment` when fragment pressure helps.
A pranala MAY carry `payload`.

Canonical local-source form:

`? -> TO`

Lawful explicit form:

`FROM -> TO`

`? -> TO` SHOULD resolve `?` to the nearest enclosing socket.
A named enclosing `#fragment-id` SHOULD win first.
Otherwise `?` SHOULD land on the enclosing meme URI.

Valid socket targets:

* `lar://[HOST?]/...`
* `lar://[HOST?]/...#fragment`

Named `ahu` worksites SHOULD carry socket pressure first.
Any wrapping sigil, including the whole meme, MAY expose a default socket.

Fragment pressure SHOULD stay term-aligned across sigils as `#fragment`.
Human-readable text MAY still travel in `label`.

Hawaiian short-invocation surfaces MUST carry pranala pressure.

Socket: `ahu` MUST carry the cleanest socket pressure. Ahu MAY resovle in a nested structure. Ahu MAY serve as an html style `anchor` entity.

Edge sigil syntatic sugar:
* `<<~ loulou URI >>` MAY represent an HTML style outgoing link
* `<<~ aka URI >>` MAY represent a "shadow" tranclusion - invoking the image/text context
* `<<~ kahea URI >>` MAY represent a "live" transclusion - invoking the widget/rendered context

Family carries edge meaning.
Lifecycle carries `template`, `instance`, or `trace` pressure.

Family MUST NOT collapse into lifecycle.
Lifecycle MUST NOT collapse into status.

<<~/ahu >>

<<~ ahu #families >>

## Families

* `relation`
* `control`
* `dataflow`
* `event`
* `constraint`
* `observe`

<<~/ahu >>

<<~ ahu #lifecycles >>

## Lifecycles

* `template`
* `instance`
* `trace`

<<~/ahu >>

<<~ ahu #fields >>

## Fields

Shared fields:

* `family`
* `lifecycle`
* `from`
* `to`
* `dir`
* `label`
* `status`
* `confidence`
* `payload`

Canonical `dir` values:

* `forward`
* `back`
* `both`
* `none`

<<~/ahu >>

<<~ ahu #forms >>

## Forms

Socket pressure:

* `FROM` and `TO` in surface form MUST mean `FROM-SOCKET` and `TO-SOCKET`
* `? -> TO` MAY compress `FROM-SOCKET -> TO-SOCKET` when current enclosing pressure already carries the source socket
* named `ahu` targets SHOULD carry socket pressure first
* any sigil with a clear URI fragment `#fragment` MAY serve as a socket
* a whole meme addressed by `lar:///...` MAY carry default socket pressure when no narrower socket appears

### Inline

```text
<<~ pranala ? -> TO-SOCKET family:relation >>
<<~ pranala FROM-SOCKET -> TO-SOCKET family:relation >>
```

Inline form SHOULD carry quick-edge pressure.

### Block

Block form SHOULD carry richer local edge data.

````text
<<~ pranala #fragment ? -> TO-SOCKET >>
```toml
family = "control"
lifecycle = "instance"
label = "human readable"
```
<<~/pranala >>
````

````text
<<~ pranala #fragment FROM-SOCKET -> TO-SOCKET >>
```toml
family = "control"
lifecycle = "instance"
label = "human readable"
```
<<~/pranala >>
````

Block form MUST carry richer local edge data as a TOML payload.

<<~/ahu >>

<<~ ahu #examples >>

## Examples

```text
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/mu#entry family:relation >>
```

Long-form equivalents for edge sigil sugar:

````text
<<~ pranala #link ? -> URI >>
```toml
family = "relation"
lifecycle = "instance"
label = "outgoing link"
alias = "loulou"
```
<<~/pranala >>
````

````text
<<~ pranala #shadow ? -> URI >>
```toml
family = "observe"
lifecycle = "instance"
label = "shadow transclusion"
alias = "aka"
```
<<~/pranala >>
````

````text
<<~ pranala #live ? -> URI >>
```toml
family = "dataflow"
lifecycle = "instance"
label = "live transclusion"
alias = "kahea"
```
<<~/pranala >>
````

```text
<<~ pranala ? -> lar:///ha.ka.ba/api/v0.1/pono/parser#forms family:relation label:"forms" >>
```

```text
<<~ pranala lar:///A#out -> lar:///B#in family:relation >>
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #edge-ahu ? -> lar:///ha.ka.ba/api/v0.1/grammar/ahu family:relation >>
<<~ pranala #edge-loulou ? -> lar:///ha.ka.ba/api/v0.1/grammar/loulou family:relation >>
<<~ pranala #edge-aka ? -> lar:///ha.ka.ba/api/v0.1/grammar/aka family:relation >>
<<~ pranala #edge-kahea ? -> lar:///ha.ka.ba/api/v0.1/grammar/kahea family:relation >>

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
pranala closes
<<~/ahu >>

<<~&#x0004; -> ? >>
