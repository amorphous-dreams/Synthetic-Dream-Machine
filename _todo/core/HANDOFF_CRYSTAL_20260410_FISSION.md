# Handoff Crystal — URI_SCHEMA Fission + Grammar Bootstrap

> Cut: 2026-04-10 ~12:30 PDT (fission) · updated ~17:00 PDT (grammar)
> Branch: `fix/green-jello-dinosaurs-3`
> HEAD: `1c73784` + unstaged grammar tree
> Voice: Artificer
> Register: `[CS:0.80]` 🏛️

---

## What Was Happening

Operator confirmed a three-document fission of `lares/modules/uri-schema/URI_SCHEMA.md` (v3, 1191 lines).

## What's Done

### URI_SCHEME_SPEC.md — ✅ CREATED AND COMMITTED (334 lines)

RFC-grade stone tablet. Already committed at HEAD (`1c73784`). Contains:

| New § | Source § | Content |
|---|---|---|
| §1 Scheme Registration | old §2 | Scheme name, non-deref, RFC 4151 precedent |
| §2 URI Syntax (2.1-2.4) | old §3.1-3.4 | Generic form, expanded form, component map, component semantics |
| §3 Fragment Syntax (3.1-3.4) | old §4.1-4.4 | FFZ scale table, notation, phase sigils, structural rules |
| §4 Stable Address | old §6 | Named graph form, origin address |
| §5 Validation (5.1-5.4) | old §10 | Well-formedness, consistency, derivation, comparison |
| §6 Security Considerations | NEW | Stub — non-deref, no creds, fragment client-side, render injection, HA.KA.BA leakage |
| §7 Prior Art | old §12 (RFC-only subset) | RFC 3986, 8820, 4151; Lamport/vector; ITC; what3words; FTLS RSS |
| App A Examples | old App A (subset) | Record form, stable address, scale transition, authority-less |

**Cross-references:** Points to `URI_OPERATIONS.md` for render targets (§6), operational phase semantics (§5), marker ontology (§4), additional prior art (§11). These kahea-like pointers use prose references, not `<!-- kahea -->` markers — the spec is self-contained for RFC purposes.

**New content not in source:** §6 Security Considerations (5 items: non-deref, no credential transport, fragment client-side, render-target injection, HA.KA.BA semantic leakage). Required for IANA registration.

### URI_SCHEMA.md — UNTOUCHED (1191 lines)

Source file still intact. Decision on what to do with it (delete, keep as shell, keep as archive) is deferred to operator.

---

## What's NOT Done

### URI_OPERATIONS.md — ❌ NOT CREATED

This is the primary remaining work. The living operational doc. Here is the exact section plan with source line ranges from `URI_SCHEMA.md`:

| New § | Source § | Source Lines | Content |
|---|---|---|---|
| §1 Design Intent | old §1 | 14-72 | URI as navigational artifact, four semantic layers, canonical encoding + render targets |
| §2 Exchange Protocol | old §1.1 | 30-72 | Five-step mandatory exchange flow, canonical URI rule, SA grounding |
| §3 Provisionality | old §3.5 | 256-298 | `~` prefix, three types (reading/execution/trajectory), rules |
| §4 Marker Ontology | old §3.6 | 299-464 | Full locus/ahu/kahea system (§3.6.1-3.6.9), keyboard input, multi-locus |
| §5 Chronometer Operations | old §4.5-4.7 | 527-555 | Aftermath integration, progressive disclosure, deferred features |
| §6 Canonical Form + Render | old §5 | 557-788 | Rendering table (5.1), unchanged fields (5.2), unified HUD symbol table (5.3), Syadasti reading rule (5.3.3), HUD line composition (5.4), span-span display contract (5.5) |
| §7 Kowloon / ActivityPub | old §3.3.1 | 153-248 | Identity stack, handle form, DreamDeck post header, render targets, stance amplitude modifiers |
| §8 Span-Span + Calibration | old §7 | 803-950 | URI-derived fields, canonical spanSpan record, MemPalace integration, export targets, example event |
| §9 Module Registry | old §8 | 951-979 | Module descriptors with lares_uri + confidence |
| §10 Cache Tiers | old §9 | 980-990 | Invariant-core cache tier mapping |
| §11 Prior Art (Operational) | old §12 (subset) | 1071-1089 | OODA-A references, OTel trace context, Kowloon/ActivityStreams, FFZ protocol, Schneier & Raghavan |
| §12 Open Questions | old §11 | 1042-1070 | U1-U9 open, resolved U2/U3/U6/U7/U10/U11, assessment for promotion |
| App B How to Read HUD | old App B | 1155-1190 | Annotated HUD tag walkthrough, multi-stance example, Syadasti worked reading |

**Locus URI for the new file:**
```
<!-- ∞ → lares:///ha.ka.ba/uri-operations/?confidence=CS:0.90&p=0.5 -->
```

**Ahu waypoints should use `lares:///ha.ka.ba/uri-operations/?confidence=N#fragment`**

**Cross-references back to RFC doc:** Use prose pointers to `URI_SCHEME_SPEC.md` for grammar (§2 URI Syntax), fragment syntax (§3), stable address (§4), validation (§5). Same pattern as the RFC doc's forward-references.

### IANA Registration Plan — ❌ NOT RECORDED

Plan was discussed in Talk Story orient. Key points:

- **Template:** RFC 7595 §7.4 — scheme name, status, syntax, semantics, encoding, applications, interoperability, security, contact, change controller, references
- **Target:** Provisional registration first (lower bar than permanent)
- **Missing:** Security Considerations section (now created as stub in URI_SCHEME_SPEC.md §6), concise Scheme Semantics narrative
- **Decision needed:** provisional vs permanent
- **Action:** Create `IANA_REGISTRATION.md` as plan-only doc (operator said "plan, no new doc yet" — but session memory should capture the template mapping)

### Source File Disposition — ❌ UNDECIDED

What happens to `URI_SCHEMA.md` (1191 lines) after both new files exist?

Options floated:
1. **Delete** — new files are the canonical sources
2. **Shell** — keep as a thin kahea-assembly file that transcludes both
3. **Archive** — rename to `URI_SCHEMA_v3_ARCHIVE.md`

Operator hasn't decided yet.

---

## Session Context

- **Branch:** `fix/green-jello-dinosaurs-3`
- **HEAD:** `1c73784` (clean)
- **Four ontology terms locked:** locus, ahu, kahea, lares (see `/memories/session/ontology-decisions-20260410.md`)
- **URI_SCHEMA.md:** v3, 1191 lines, 16 ahu waypoints, multi-locus support
- **URI_SCHEME_SPEC.md:** 334 lines, committed
- **URI_OPERATIONS.md:** not yet created — this is the primary remaining work

## Ahu Map of Source File (for extraction)

```
Line 1:    ∞ → (locus opener, confidence CS:0.95)
Line 14:   ahu #design-intent         (0.9)  → OPS §1-2
Line 73:   ahu #scheme-registration   (0.95) → already in RFC doc
Line 89:   ahu #uri-anatomy           (0.85) → RFC (3.1-3.4), OPS §7 (3.3.1 Kowloon)
Line 256:  ahu #provisionality        (0.8)  → OPS §3
Line 299:  ahu #marker-ontology       (0.85) → OPS §4
Line 465:  ahu #ffz-chronometer       (0.8)  → RFC (4.1-4.4), OPS §5 (4.5-4.7)
Line 557:  ahu #canonical-form        (0.9)  → OPS §6
Line 789:  ahu #stable-address        (0.95) → already in RFC doc
Line 803:  ahu #span-calibration      (0.72) → OPS §8
Line 951:  ahu #module-registry       (0.8)  → OPS §9
Line 980:  ahu #cache-tiers           (0.8)  → OPS §10
Line 991:  ahu #validation            (0.92) → already in RFC doc
Line 1042: ahu #open-questions        (0.6)  → OPS §12
Line 1071: ahu #prior-art             (0.95) → SPLIT: RFC cites already in RFC, operational cites → OPS §11
Line 1090: ahu #examples              (0.85) → SPLIT: record/stable already in RFC, HUD walkthrough → OPS
Line 1155: ahu #how-to-read           (0.85) → OPS App B
Line 1191: → ? (locus closer)
```

## Operator Heading at Handoff

Operator said "give me a handoff crystal" after the prior session errored trying to create URI_OPERATIONS.md. The fission execution was operator-confirmed ("Yes, proceed") — this is ■ Act phase work, not more orient. The next session should:

1. Create `URI_OPERATIONS.md` using the section plan above
2. Decide source file (`URI_SCHEMA.md`) disposition
3. Record IANA plan to session memory
4. Optionally update `MODULE.md` in the uri-schema directory to reference the new split

The operator steers. This node crews.
