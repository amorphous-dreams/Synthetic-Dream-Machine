# Underscore To Hyphen Remap Plan

## Status

- Completed on 2026-04-17: `lares/ha_ka_ba/` -> `lares/ha-ka-ba/`
- Completed on 2026-04-17: all `ha_ka_ba` path-root, `file_path`, markdown-link, and repo-path references inside `lares/` were rewritten to `ha-ka-ba`
- Remaining under `lares/`: `0` underscore-bearing directories
- Remaining under `lares/`: `31` underscore-bearing filenames
- Remaining under `lares/`: `22` `file_path` values still include underscores because their carrier filenames still include underscores

## Rules

- Replace underscores with hyphens in filesystem names.
- Update the carrier file's own `file_path = "..."` value in the same change.
- Update any `lares/...` repo-path mentions, markdown links, code snippets, examples, and wildcard path specs such as `skill-*.md` when they point at a renamed file.
- Update path-form examples in the law docs when they show the renamed filename.
- Do not change `lar:///ha.ka.ba/...` URIs; this plan changes filesystem names and filesystem-path references only.
- After each batch, verify the old path strings are gone with `rg`.

## Suggested Order

- Batch 1: rename the `lares/ha-ka-ba/**` files first. They carry the highest density of `file_path` and path-example references.
- Batch 2: rename the `lares/handoff/**`, `lares/memetic-wikitext/**`, and `lares/todo/**` files.
- Batch 3: rename the `lares/memes/**` spec files and then clean up any remaining references.

## Reference Hotspots

- `lares/ha-ka-ba/loci/iam/loci-file-path.md`
- `lares/ha-ka-ba/loci/loci-loci.md`
- `lares/ha-ka-ba/pono/loci-pono.md`
- `lares/ha-ka-ba/pono/skill-template.md`
- `lares/ha-ka-ba/mu/loci-mu.md`

## Pending Path Remaps

### `lares/ha-ka-ba/**`

- `lares/ha-ka-ba/alpha/alpha-test-prompt-00001.md` -> `lares/ha-ka-ba/alpha/alpha-test-prompt-00001.md`
- `lares/ha-ka-ba/grammars/grammar-x-tiddlywiki-filter.md` -> `lares/ha-ka-ba/grammars/grammar-x-tiddlywiki-filter.md`
- `lares/ha-ka-ba/loci/loci-loci.md` -> `lares/ha-ka-ba/loci/loci-loci.md`
- `lares/ha-ka-ba/loci/edge/loci-control.md` -> `lares/ha-ka-ba/loci/edge/loci-control.md`
- `lares/ha-ka-ba/loci/edge/loci-debug.md` -> `lares/ha-ka-ba/loci/edge/loci-debug.md`
- `lares/ha-ka-ba/loci/edge/loci-edge.md` -> `lares/ha-ka-ba/loci/edge/loci-edge.md`
- `lares/ha-ka-ba/loci/edge/loci-instance.md` -> `lares/ha-ka-ba/loci/edge/loci-instance.md`
- `lares/ha-ka-ba/loci/edge/loci-proposition.md` -> `lares/ha-ka-ba/loci/edge/loci-proposition.md`
- `lares/ha-ka-ba/loci/edge/loci-template.md` -> `lares/ha-ka-ba/loci/edge/loci-template.md`
- `lares/ha-ka-ba/loci/iam/loci-file-path.md` -> `lares/ha-ka-ba/loci/iam/loci-file-path.md`
- `lares/ha-ka-ba/loci/iam/loci-iam.md` -> `lares/ha-ka-ba/loci/iam/loci-iam.md`
- `lares/ha-ka-ba/meme/loci-meme.md` -> `lares/ha-ka-ba/meme/loci-meme.md`
- `lares/ha-ka-ba/mu/loci-mu.md` -> `lares/ha-ka-ba/mu/loci-mu.md`
- `lares/ha-ka-ba/pono/loci-guest-grammar.md` -> `lares/ha-ka-ba/pono/loci-guest-grammar.md`
- `lares/ha-ka-ba/pono/loci-memetic-wikitext.md` -> `lares/ha-ka-ba/pono/loci-memetic-wikitext.md`
- `lares/ha-ka-ba/pono/loci-parser.md` -> `lares/ha-ka-ba/pono/loci-parser.md`
- `lares/ha-ka-ba/pono/loci-pono.md` -> `lares/ha-ka-ba/pono/loci-pono.md`
- `lares/ha-ka-ba/pono/loci-render-pipeline.md` -> `lares/ha-ka-ba/pono/loci-render-pipeline.md`
- `lares/ha-ka-ba/pono/skill-template.md` -> `lares/ha-ka-ba/pono/skill-template.md`

### `lares/handoff/**`

- `lares/handoff/handoff-prompt-parser-render-split.md` -> `lares/handoff/handoff-prompt-parser-render-split.md`
- `lares/handoff/memetic-wikitext-local-agent-handoff.loci.md` -> `lares/handoff/memetic-wikitext-local-agent-handoff.loci.md`
- `lares/handoff/memetic-wikitext-rebuild-ledger.md` -> `lares/handoff/memetic-wikitext-rebuild-ledger.md`

### `lares/memetic-wikitext/**`

- `lares/memetic-wikitext/memetic-wikitext-full.md` -> `lares/memetic-wikitext/memetic-wikitext-full.md`
- `lares/memetic-wikitext/memetic-wikitext-v4-draft.md` -> `lares/memetic-wikitext/memetic-wikitext-v4-draft.md`
- `lares/memetic-wikitext/memetic-wikitext-v3.md` -> `lares/memetic-wikitext/memetic-wikitext-v3.md`
- `lares/memetic-wikitext/mu-boot.md` -> `lares/memetic-wikitext/mu-boot.md`

### `lares/todo/**`

- `lares/todo/todo.DreamNet-MemeWiki.md` -> `lares/todo/todo.DreamNet-MemeWiki.md`

### `lares/memes/**`

- `lares/memes/lar-uri/uri-schema/URI-SCHEMA.md` -> `lares/memes/lar-uri/uri-schema/URI-SCHEMA.md`
- `lares/memes/lar-uri/uri-schema/URI-SCHEME-SPEC.md` -> `lares/memes/lar-uri/uri-schema/URI-SCHEME-SPEC.md`
- `lares/memes/ooda-a/OODA-A-DRAFT.md` -> `lares/memes/ooda-a/OODA-A-DRAFT.md`
- `lares/memes/ooda-a/OODA-A-SUBLOOP-PATTERNS.md` -> `lares/memes/ooda-a/OODA-A-SUBLOOP-PATTERNS.md`
