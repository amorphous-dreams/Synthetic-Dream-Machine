# `lares:` URI Schema — MOVED

> This file was the working draft. It has been superseded and is no longer maintained.
> **Canonical location:** `lares/sprints/0/URI_SCHEMA.md`

---

## What changed

| Topic | Old (this file) | Canonical (`lares/sprints/0/`) |
|---|---|---|
| Form model | "machine form" + "sigil form" (co-primary) | Canonical record form + named render targets |
| `:port` slot | `seq_num` — monotonic event sequence number | **Dropped.** `tick_seq` lives in TickSpan calibration metadata, not URI authority. (Resolved question: old U2) |
| Authority layers | WHERE / HOW / WHEN (3 layers) | WHO / WHERE / HOW / WHEN (4 layers — `userinfo@host` explicit) |
| `intent_header_snapshot` | Stored sigil/glyph form | Stored canonical record form |
| §1.1 Exchange Flow | Absent | 5-step mandatory order of operations |
| Canonical URI rule | Absent | All emitted URIs in stream are canonical record form; glyphs are display-only |
| §5 title | "Bidirectional Projection — Display Split" | "Canonical Form and Render Targets" |
| §5.4 HUD Line | Absent | SA-grounded field-ordering spec (§5.4) |
| §5.5 Tick-Span | Basic 5-step list | Full URI-type taxonomy; mid-generation shift URI; sub-agent handoff form |
| §3.2 | Full form only | Full form + authority-less form (`lares:///ha/ka/ba`) + HUD dot-notation rule |
| Open questions | U1–U6 (incl. old U2 = port slot) | U1–U6 updated; old U2 logged as resolved in §11 |
| Promotion recommendation | Present | Present (updated) |

---

Do not update this file. All changes go to `lares/sprints/0/URI_SCHEMA.md`.
