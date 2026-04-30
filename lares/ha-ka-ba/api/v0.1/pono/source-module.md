<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/pono/source-module >>

<<~ ahu #iam >>

```toml
uri-path     = "ha.ka.ba/api/v0.1/pono/source-module"
file-path    = "lares/ha-ka-ba/api/v0.1/pono/source-module.md"
content-type = "text/x-memetic-wikitext"
tagspace     = "invariant"
confidence   = 0.78
register     = "CS"
manaoio      = 0.76
mana         = 0.82
manao        = 0.80
role         = "interface meme for source-module carrier: package TypeScript source files emitted as memes into the graph"
cacheable    = true
retain       = true
```

<<~/ahu >>


<<~ ahu #law >>

## Law

A source-module meme carries the verbatim source text of one TypeScript/TSX file
as its body, with structured fields naming its package, path, and exports.

Source modules are emitted by a postbuild script (`write-source-memes.ts`) that
runs after each `pnpm build` in the monorepo. They are NOT checked into `lares/` —
they are generated artifacts written into the Automerge store at boot.

This makes the monorepo's source navigable through the meme graph:
agents can read, query, and react to source changes as memes.

<<~/ahu >>

<<~&#x0002;>>


<<~ ahu #carrier-shape >>

## Carrier Shape

```toml
uri            = "lar:///source/<package-name>/<relative-src-path>"
               # e.g. lar:///source/lararium-core/src/live-protocol.ts

[fields]
package        = "@lararium/core"         # pnpm package name
src-path       = "src/live-protocol.ts"   # path relative to package root
lang           = "typescript"             # typescript | tsx | javascript
built-at       = "ISO 8601 timestamp"
content-hash   = "SHA-256 hex of source text"
exports        = ["ReactionGraph", "ReactionBinding", ...]  # named exports
```

The body (`text`) is the verbatim source content.

<<~/ahu >>

<<~ ahu #priority-modules >>

## Priority Modules

These files are the highest-value source-module memes:

```
@lararium/core    src/parser.ts           — memetic-wikitext parser
@lararium/core    src/ast.ts              — AST node types + LADDER_5/OODA_HA_5
@lararium/core    src/causal-island.ts    — causal island doctrine + AuthorityFirstGuard
@lararium/core    src/live-protocol.ts    — wire protocol types + ReactionGraph
@lararium/tw5     src/lararium-tw5.ts     — TW5 integration facade
@lararium/app     src/LarariumPanel.tsx   — HUD + TW5 panel component
@lararium/app     src/LarariumShell.tsx   — shell root
```

<<~/ahu >>

<<~ ahu #postbuild-contract >>

## Postbuild Contract

The `write-source-memes.ts` script MUST:

1. Run after each successful build in affected packages.
2. For each priority source file: read, hash, emit a carrier meme into the store.
3. Use origin `{ kind: "operator-import" }` — source memes are canon-hydrate peers.
4. Overwrite existing carrier if content-hash differs; no-op if hash matches.
5. Never emit noise or data files — only files with named exports that implement
   invariant interfaces or architectural law.

<<~/ahu >>


<<~ ahu #edges >>

<<~ pranala #implements-invariant ? -> lar:///ha.ka.ba/api/v0.1/pono/invariant family:control role:implements >>
<<~ pranala #builds-meme ? -> lar:///ha.ka.ba/api/v0.1/pono/meme family:control role:extends >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
