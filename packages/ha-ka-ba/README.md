# @lararium/ha-ka-ba — engine corpus root (URI namespace anchor only)

This directory is a URI namespace anchor. It holds no meme files itself.

## URI mapping law

```
packages/{pkg-slug}/memes/{path}.md
  →  lar:///ha.ka.ba/{@npm-scope/name}/v{version}/{path}
```

Each `@lararium/*` package owns its meme tree under its own `memes/` directory.

## Package → URI root mapping

| Package memes/          | Package            | URI root                              |
|-------------------------|--------------------|---------------------------------------|
| lararium-core/memes/    | @lararium/core     | lar:///ha.ka.ba/@lararium/core/v0.1/  |
| lararium-tw5/memes/     | @lararium/tw5      | lar:///ha.ka.ba/@lararium/tw5/v0.1/   |
| lararium-node/memes/    | @lararium/node     | lar:///ha.ka.ba/@lararium/node/v0.1/  |

## Two kinds of content

**Self-documentation memes** — hand-authored `.md` carrier files describing TypeScript
symbols, invariants, and runtime behavior that cannot be expressed as pure wiki content.
Fields: `source-file`, `source-symbol`, pranala edges to what they implement/produce.

**Compiled engine tiddlers** — Vite-rendered IIFE bundles injected as a `text` field
into a carrier file at build time. The carrier `.md` holds documentation in ahu slots;
the compiled JS lands in a `module-text` field via post-build script.

## Seeding path

The engine corpus walker reads each package's `memes/` directory, resolves the URI from
the package name + version (from `package.json`), and ingests records into the engine
MemeStoreDoc (bag: `engine`). Separate from the binary-blob EngineDoc.
