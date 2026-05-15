<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/@lares/api/v0.1/pono/memetic-wikitext >> -->

<<~⊙&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/pono/lele >>
```toml iam
uri-path  = "ha.ka.ba/@lares/api/v0.1/pono/lele"
file-path = "bags/@lares/api/v0.1/pono/lele.md"
type      = "text/x-memetic-wikitext"
confidence = 0.75
register  = "S"
role      = "fire-and-forget dispatch sigil — lele as unconditional send; English alias: \\branch; async-first concurrency sprint pending"
cacheable = true
retain    = true
```

<<~ ahu #head >>

# Lele

*lele* — Hawaiian: to fly, jump, leap; to move quickly; to pass over. Used in *lele kawa* (cliff
diving). The motion is unconditional — the body commits to the arc without waiting for a response.

A fire-and-forget dispatch sigil. Emits a message-family edge and continues without waiting for
the target's response. English alias: `\branch`.

Distinct from Verse `branch` (cancellable speculative fiber). `lele` sends unconditionally —
the message travels whether or not the receiver acknowledges.

Concurrency runtime pending (async-first sprint). Current tiddler registers grammar only.

<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #law >>

## Law (Kānāwai)

A lele edge MUST carry a target URI as its first argument.
A lele edge MUST emit a message-family pranala and continue without blocking.
A lele edge MUST NOT wait for a response from the target.

<<~/ahu >>

<<~ ahu #syntax >>

## Syntax

```text
<<~ lele lar:///target/uri >>
<<~ \branch lar:///target/uri >>
```

<<~/ahu >>

<<~ ahu #edges >>

## Edges

<<~ pranala #tiddler ? -> lar:///ha.ka.ba/@lararium/tw5/tiddlers/sigil-branch family:control role:alias >>

<<~/ahu >>

<<~&#x0003;>>

<<~&#x0004; -> ? >>
