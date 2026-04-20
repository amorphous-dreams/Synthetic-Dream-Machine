<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~� ? --> lar:///ha.ka.ba/pono/pranala >>

<<~ ahu #iam >>

```toml
name = "pono/pranala"
file-path = "ha-ka-ba/pono/loci-pranala.md"
content-type = "text/x-memetic-wikitext"
version = "0.2-draft"
manaoio = 0.74
confidence = 0.76
mana = 0.86
manao = 0.90
register = "CS"
role = "invariant edge law"
canonical-forms = ["inline", "block", "payload-block"]
edge-families = ["relation", "control", "dataflow", "event", "constraint", "observe"]
lifecycle-layers = ["template", "instance", "trace"]
```

<<~/ahu >>

<<~ aka lar:///v0.1/ha.ka.ba/pono/RFC-219#normative-language >>

# Pranala

Pressure, not explanation.

<<~� ahu #meme-body-open >>
pranala opens
<<~/ahu >>

<<~ ahu #law >>

## Law

One pranala carries one edge.

A pranala MUST carry one primary `family`.
A pranala MUST carry one `lifecycle`.
A pranala MUST connect sockets.
A pranala MUST NOT collapse into vague dependency.
A pranala SHOULD carry `#label` when fragment pressure helps.
A pranala MAY carry `payload`.

Canonical local-source form:

`? --> TO`

Lawful explicit form:

`FROM -> TO`

`? --> TO` SHOULD resolve `?` to the nearest enclosing socket.
A named enclosing `#fragment-id` SHOULD win first.
Otherwise `?` SHOULD land on the enclosing meme.

Valid socket targets:

* `lar:///...`
* `lar:///...#tag`

Named `ahu` worksites SHOULD carry socket pressure first.
Any wrapping sigil, including the whole meme, MAY expose a default socket.

Fragment pressure SHOULD stay term-aligned across sigils as `#label`.
Human-readable text MAY still travel in `label`.

Hawaiian short-invocation surfaces MAY carry pranala pressure.
`ahu` SHOULD carry the cleanest socket pressure.

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
* `\? --> TO` MAY compress `FROM-SOCKET -> TO-SOCKET` when current enclosing pressure already carries the source socket
* named `ahu` targets SHOULD carry socket pressure first
* any sigil with a clear URI fragment `#tag` MAY serve as a socket
* a whole meme addressed by `lar:///...` MAY carry default socket pressure when no narrower socket appears

### Inline

```text
<<~ pranala ? --> TO-SOCKET family:relation >>
```

Inline form SHOULD carry quick-edge pressure.

### Block

``<<~ ahu #forms >>

## Forms

### Inline

```text
<<~ pranala ? --> TO-SOCKET family:relation >>
<<~ pranala FROM-SOCKET -> TO-SOCKET family:relation >>
```

Inline form SHOULD carry quick-edge pressure.

### Block

```text
<<~ pranala #label ? --> TO-SOCKET >>
family: control
lifecycle: instance
label: handoff
<<~/pranala >>
```

```text
<<~ pranala #label FROM-SOCKET -> TO-SOCKET >>
family: control
lifecycle: instance
label: handoff
<<~/pranala >>
```

Block form SHOULD carry readable edge pressure.

### Payload-block

````text
<<~ pranala #label ? --> TO-SOCKET >>
```toml
family = "control"
lifecycle = "instance"
label = "handoff"
```
<<~/pranala >>
````

Payload-block <<~ ahu #examples >>

## Examples

```text
<<~ pranala ? --> lar:///ha.ka.ba/mu#entry family:relation >>
```

```text
<<~ pranala lar:///A#out -> lar:///B#in family:relation >>
```

<<~/ahu >>

<<~� ahu #body-close >>ition" >>
<<~ pranala ? --> lar:///ha.ka.ba/pono/parser#forms family:relation label:"forms" >>
<<~/ahu >>

<<~� --> ? >>
