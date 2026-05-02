# @lararium/ha-ka-ba — engine self-documentation corpus

## URI mapping law

```
packages/ha-ka-ba/{package-slug}/{path}.md
  →  lar:///ha.ka.ba/{npm-scope/name}/v{version}/{path}
```

Version resolves from the source package's `package.json` at seeding time.
URIs are immutable per version. Pranala edges pin to the version they reference.

## Subdirectory → package mapping

| Directory        | Package            | URI root                             |
|------------------|--------------------|--------------------------------------|
| lararium-core/   | @lararium/core     | lar:///ha.ka.ba/@lararium/core/v0.1/ |
| lararium-tw5/    | @lararium/tw5      | lar:///ha.ka.ba/@lararium/tw5/v0.1/  |
| lararium-node/   | @lararium/node     | lar:///ha.ka.ba/@lararium/node/v0.1/ |

## Two kinds of content

**Self-documentation memes** — hand-authored `.md` carrier files describing TypeScript
symbols, invariants, and runtime behavior that cannot be expressed as pure wiki content.
Fields: `source-file`, `source-symbol`, pranala edges to what they implement/produce.

**Compiled engine tiddlers** — Vite-rendered IIFE bundles injected as a `text` field
into a carrier file at build time. These become `text/javascript` tiddlers in the
engine corpus doc. The carrier `.md` holds documentation in ahu slots; the compiled
JS lands in a `module-text` field via post-build script.

## Seeding path

`engine-island.ts` (or a new `engine-corpus-island.ts`) walks this tree,
reads source package versions, resolves URIs, and ingests records into the
engine MemeStoreDoc (bag: `engine`). Separate from the binary-blob EngineDoc
(which carries the TW5 core JS and plugin blobs).
