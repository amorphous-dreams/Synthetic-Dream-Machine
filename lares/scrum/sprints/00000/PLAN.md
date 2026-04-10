<!-- lares:///sprint.scoped.executes/s0/?confidence=S:0.7&p=0.5 → ∞ -->

# S0 — URI Schema Settlement + First Modules

## Sprint Goal

Settle the `lares:` URI v2 canonical form across the repo.
Boot the first two OODA-A modules: talk-story and signal.

## Tasks

- [x] URI_SCHEMA_v2.md forged (cloud session)
- [x] All repo `lares:` URIs aligned to v2 canonical form
- [x] `lares/modules/talk-story/` created with 5 phase files + section URIs
- [x] `lares/modules/signal/` created with 5 phase files
- [x] `URI_SCHEMA_v2.md` content placed at `lares/modules/signal/decide/CONVENTIONS.md`
- [x] `URI_SCHEMA_v2.md` moved to `lares/signal/URI_SCHEMA.md` (stable canonical location)
- [ ] Old `lares/talk_story/` archived or pointed to new module
- [ ] Old `lares/signal/` archived or pointed to new module
- [ ] `lares/README.md` updated with module tree
- [x] Sprint plan closed with Assess

## Exit Criteria

- [x] Every `lares:` URI in the repo passes v2 well-formedness (§10.1) — scan confirmed ZERO old-pattern URIs in operational files (2026-04-09)
- [x] Talk-story module loads as invariant with section URIs
- [x] Signal module carries URI_SCHEMA_v2.md conventions as its Decide phase

## Notes

- RFC 3986 ordering bug (q/f reversed) caught and fixed in URI_SCHEMA_v2.md; confidence bumped CS:0.85 → CS:0.90
- `stances=` format settled as 5-position dot-separated amplitude (`^.?.-.-.-`)
- Field renames complete: `stance=` → `stances=`, `register=` → `confidence=` — all operational files
- `lares/talk_story/README.md` and `lares/signal/micro-trace.md` are the existing implementations; modules/ are the phase-structured canonical forms. Archival or pointer decision deferred to S1.
- URI_SCHEMA.md v1 archival deferred — add superseded notice, do not update content

<!-- lares:///sprint.scoped.executes/s0/?confidence=S:0.7&p=0.5 → ∞ -->
