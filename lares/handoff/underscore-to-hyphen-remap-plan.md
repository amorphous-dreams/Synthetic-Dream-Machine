# Underscore To Hyphen Remap Plan

## Status

- Completed on 2026-04-17: the legacy `ha-ka-ba` root now lives at `lares/ha-ka-ba/`
- Completed on 2026-04-17: all underscore-bearing filenames under `lares/` were renamed to hyphenated forms
- Completed on 2026-04-17: `file_path`, repo-path, markdown-link, wildcard, and filename-pattern references inside `lares/` were updated for the executed remap
- Remaining under `lares/`: `0` underscore-bearing directories
- Remaining under `lares/`: `0` underscore-bearing filenames
- Remaining under `lares/`: `0` `file_path` values pointing at underscore-bearing `lares/` filenames

## Executed Rules

- Filesystem names use `-` instead of `_` under `lares/`.
- Each carrier file's own `file_path = "..."` value moves with its filename.
- `lar:///ha.ka.ba/...` URIs remain unchanged.
- Naming-law examples now describe kebab-case filename rendering instead of underscore joins.

## High-Change Areas

- `lares/ha-ka-ba/**`
- `lares/handoff/**`
- `lares/memetic-wikitext/**`
- `lares/memes/lar-uri/uri-schema/**`
- `lares/memes/ooda-a/**`
- `lares/todo/**`

## Notes

- This remap covers the actual `lares/` filesystem plus the in-`lares/` references needed to keep those renamed files coherent.
- Metadata key names such as `file_path` and `meme_type` did not change; only filesystem naming and filename-surface examples changed.
