

<a id="/entry"></a>

# Procedure Parameter Handling ~ a name the definition never declared

**Branch** `tiddlywiki-com` · **File** `editions/tw5.com/tiddlers/procedures/Procedure Parameter Handling.tid`

**Title** Document that a parameter the definition does not declare reaches nothing

<a id="/the-claim"></a>

## The gap this fills

`Procedure Parameter Handling` states the success case and stops:

> Procedures parameters are made available as variables when the procedure contents are wikified.

Every example there declares what it passes, so a reader meets only calls that work. The page never
says what a call does with a name the definition **does not** declare — and the answer carries a
sharp edge: the value reaches nothing, `<<name>>` resolves empty, and no error appears anywhere.

**A misspelt parameter name reads exactly like a forgotten one.** Both spell an empty variable in the
output, which a reader then hunts through the wrong half of their code, because the call site looks
correct and the definition looks correct and only their DISAGREEMENT carries the fault.

<a id="/the-change"></a>

## The proposed change

Add a section after *Accessing Parameters as Variables*.

```
!! Parameters Not Declared by the Definition

A procedure receives only the parameters its definition declares. A name passed at the call site
that the definition does not list reaches nothing, and the corresponding variable reads as empty.

<<.warning """No error is reported. A misspelt parameter name produces the same empty value as one
the definition never declared, so check the definition's parameter list against the call site
whenever a parameter reads empty.""">>
```

<a id="/for-the-reviewer"></a>

## Notes for the reviewer

The page's own `say-hi` example carries the whole demonstration, so the correction needs no new one.

The behaviour follows from the design rather than working against it: a procedure's parameters bind
as variables, and a variable nothing declares has no slot to bind to. Naming the consequence costs a
reader nothing and saves the search.

**A caller cannot forward a parameter it has not itself declared.** This falls out of the same rule
and matters to anyone writing a wrapper: a generic forwarding procedure can pass on only the names it
lists in its own signature, so a dispatcher standing between a call and its target drops every name
the dispatcher does not know. Worth a sentence if the reviewer wants one; the correction above stands
without it.

<a id="/measured"></a>

## Measured

Rendered against the vendored TiddlyWiki core, using the page's own example:

```
\procedure say-hi(name address)
Hi <<name>>, at <<address>>.
\end
```

|  definition |  call |  output |
|---|---|---|
| `say-hi(name address)` | `<<say-hi name:"Bugs" address:"Rabbit Hole Hill">>` | `Hi Bugs, at Rabbit Hole Hill.` |
| `say-hi(name)` | `<<say-hi name:"Bugs" address:"Rabbit Hole Hill">>` | `Hi Bugs, at .` |
| `say-hi(name)` | `<<say-hi name="Bugs" address="Rabbit Hole Hill">>` | `Hi Bugs, at .` |
| `say-hi(name adress)` | `<<say-hi name:"Bugs" address:"Rabbit Hole Hill">>` | `Hi Bugs, at .` |
| `say-hi(name)` | `<<say-hi "Bugs" "Rabbit Hole Hill">>` | `Hi Bugs, at .` |

**The last four rows spell one output and four different faults** — a name never declared, the same
under either separator, a typo in the declaration, and a positional past the arity. Nothing in the
render tells them apart.

<a id="/edges"></a>

## Edges

- `"lar:///ha.ka.ba/lares/docs/tw5-calls-colon-caveat"`
- `"lar:///ha.ka.ba/lares/api/pono/tiddlywiki-wikitext"`
