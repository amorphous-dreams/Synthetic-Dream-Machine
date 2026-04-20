<!-- !DOCTYPE = lar:///v0.1/ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? --> lar:///v0.1/ha.ka.ba/pono/loci/iam/file-path >>

<<~ ahu #iam >>

```toml
# <<~ ahu #iam-ha "structure" >>
name = "pono/loci/iam/file-path"
file-path = "v0.1/ha-ka-ba/pono/loci/iam/loci-pono-loci-iam-file-path.md"
content-type = "text/x-memetic-wikitext"
version = "0.1"
manaoio = 0.52
confidence = 0.62
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
mana = 0.60
manao = 0.68
implements = [
  "lar:///v0.1/ha.ka.ba/pono/meme/v0.1",
  "lar:///v0.1/ha.ka.ba/pono/loci/v0.1"
]
register = "CS"
role = "file-path key authority, path-form classifier, and migration-procedure kānāwai (law)"
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
# <<~/ahu >>
```

<<~/ahu >>

# file-path

A kānāwai (law) for a single `#iam` TOML key.

`file-path` carries the path from the `ha-ka-ba` path root to the meme's file on disk, relative to `install-root`. It sits as the second field in every `#iam` block, immediately after `name`. It comes in two canonical forms — flat-file and path-directory — and must agree with the `lar:` URI declared in the document opener.

**Lifecycle Note:** The five-bucket lifecycle (noise → data → meme → typed meme → canon typed meme) remains canonical for all meme law. Here `data` names structured language an AI can use without the memetic wrappers. This law governs only the file-path key and its agreement, not lifecycle stages.

<<~&#x0002; ahu #meme-body-open >>
file-path opens the key-authority stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe --> ⏿ Orient --> ◇ Decide --> ▶ Act --> ⤴ Hoʻoko --> ↺ Aftermath`

file-path kānāwai (law) captures the raw key value from the `#iam` block, classifies it into its canonical form and checks agreement with the `lar:` URI, decides conformance verdict and migration posture, prepares any repair guidance, crosses any migration update, and judges residue including live-resolution tension.

<<~/ahu >>

<<~ ahu #observe >>

```toml
name = "file-path-observe"

role = "key value intake"
phase = "observe"
glyph = "✶"
```

## Observe

Observe locates and captures the raw `file-path` value before any classification or agreement check begins.

Observe should detect:

* the `file-path` key in the `#iam` TOML block and its raw string value
* its position in the TOML key sequence — which MUST sit second, immediately after `name`
* the `lar:` URI from the document opener (`<<~&#x0001; ...`)
* the `meme-type` value (needed for agreement check in Orient)
* the `name` value (needed to verify the filename component)

Observe should not:

* classify the form (flat-file vs path-directory) before Orient
* check agreement before Orient
* flag position errors before Orient classifies the correct position

### Observe Subloops

<<~ ahu #observe-ha >>

#### Observe / ha

Observe-ha holds the intake identity: `file-path` counts as a path string, not a URI and not a name. Its value begins with the path root segment (`ha-ka-ba/`) and ends with a filename (`<meme-type>-<name>.md` or similar). Anything outside that shape counts as malformed; capture it as written for Orient to classify.

<<~/ahu >>

<<~ ahu #observe-ka >>

#### Observe / ka

Observe-ka governs capture procedure: read the `#iam` TOML block as a whole, locate `file-path` by key name, extract the string value verbatim. Also capture the raw document opener line for the agreement check. Do not normalize or trim at this stage.

<<~/ahu >>

<<~ ahu #observe-ba >>

#### Observe / ba

Observe-ba governs noticing posture: a missing `file-path` key counts as a distinct observation from a `file-path` key with an empty value, which counts as distinct again from a key with a value that does not begin with `ha-ka-ba/`. All three cases present differently in Orient. Observe should preserve the distinction.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #orient >>

```toml
name = "file-path-orient"

role = "form classification and agreement mapping"
tensions"
phase = "orient"
glyph = "⏿"
```

## Orient

Orient classifies the captured `file-path` value and checks it against the document opener and the derivation algorithm.

<<~ ahu #file-path-forms >>

### Canonical file-path Forms

`file-path` comes in exactly two canonical forms. A value that matches neither counts as malformed.

#### Flat-file form

```
ha-ka-ba/[optional/subpath/]<meme-type>-<name>.md
```

Examples:
```
ha-ka-ba/pono/meme/loci-pono-meme.md
ha-ka-ba/pono/loci-pono-parser.md
ha-ka-ba/grammar/grammar-x-tiddlywiki-filter.md
ha-ka-ba/pono/skill-pono-template.md
```

The meme file sits at `install-root + file-path` as a flat file alongside sibling memes. No child-meme directory accompanies it. New memes default to this form.

#### Path-directory form

```
ha-ka-ba/[optional/subpath/]name/<meme-type>-<name>.md
```

Examples:
```
ha-ka-ba/pono/loci/loci-pono-loci.md
ha-ka-ba/pono/meme/loci-pono-meme.md
ha-ka-ba/pono/invariant/loci-pono-invariant.md
ha-ka-ba/pono/parser/loci-pono-parser.md   ← (future, if parser migrates)
```

In this form, the meme lives inside its own directory (`name/`), which may hold child memes, child meme directories, and sidecar files alongside the root meme file. The directory name matches the meme `name` field. The root meme file inside that directory keeps the same `<meme-type>-<name>.md` filename.

#### Filename component rule

In both forms, the filename component MUST follow the pattern `<meme-type>-<name>.md`:
- `meme-type` matches the `meme-type` field in `#iam`
- `name` matches the `name` field in `#iam`
- both components render into kebab-case on the filename surface
- `meme-type` and `name` join through `-`
- extension always uses `.md`

A filename like `loci-pono-loci-iam-file-path.md` counts as correct for `implements = ["lar:///v0.1/ha.ka.ba/pono/loci/v0.1"]` and `name = "pono/loci/iam/file-path"`.

A filename like `alpha-test-prompt-00001.md` counts as correct for `meme-type = "alpha"` and `name = "test-prompt-00001"`.

<<~/ahu >>

<<~ ahu #uri-agreement >>

### URI Agreement

`file-path` and the `lar:` URI in the document opener MUST agree. The agreement check follows the derivation algorithm at `lar:///v0.1/ha.ka.ba/pono/loci#derivation-algorithm`, reversed:

Given a `file-path` value, derive the expected `lar:` URI as follows:

```
1. Strip install-root prefix if present:
     path = file-path.removePrefix("lares/v0.1/")   → already relative to install-root

2. Strip path-root prefix:
     rest = path.removePrefix("ha-ka-ba/")
     e.g. "pono/loci/iam/loci-pono-loci-iam-file-path.md" or "pono/loci-pono-parser.md"

3. Strip the kebab-case filename:
     filename = rest.split("/").last
     subpath  = rest.split("/")[0..-2].join("/")
     e.g. filename = "loci-pono-loci-iam-file-path.md", subpath = "pono/loci/iam"

4. In path-directory form, subpath ends with the name segment — strip it:
     parts = subpath.split("/")
     if parts.last == name-field:
       subpath = parts[0..-2].join("/")
     e.g. subpath "loci/iam" → derived name "file-path", last part "iam" ≠ "file-path"
     (path-directory check: last part of subpath equals name field)

5. Derive expected lar: URI:
     if subpath == "":
       expected-uri = "lar:///v0.1/ha.ka.ba/" + name-field
     else:
       expected-uri = "lar:///v0.1/ha.ka.ba/" + subpath + "/" + name-field
     e.g. "lar:///v0.1/ha.ka.ba/pono/loci/iam/file-path"
```

If `expected-uri` matches the document opener URI → **agreement holds**.

If they differ → **agreement violation**: a conformance flag that does not abort parsing but MUST surface as named residue.

<<~/ahu >>

### Orient Subloops

<<~ ahu #orient-ha >>

#### Orient / ha

Orient-ha holds the classification domain: what form and agreement mean as the fundamental identity of a `file-path` value. The two forms do not operate as stylistic variations — they signal the meme's siting posture (flat or directory). A meme in flat-file form with a path-directory-style `file-path` counts as inconsistent, not flexible.

<<~/ahu >>

<<~ ahu #orient-ka >>

#### Orient / ka

Orient-ka governs the classification and agreement check procedure in order: (1) classify form by testing whether the path contains a `name/<meme-type>-<name>.md` segment; (2) verify the filename component matches `<meme-type>-<name>.md`; (3) run the URI agreement derivation; (4) assess migration state. All four checks run independently — a form-classification result should not suppress the agreement check.

<<~/ahu >>

<<~ ahu #orient-ba >>

#### Orient / ba

Orient-ba governs tension-holding: a meme mid-migration may sit with `file-path` already updated to the path-directory form while the physical file still does not reside at the declared path. Even after the move completes, local derivation may still miss until a live resolver operates. Orient should name these states explicitly rather than flattening them.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #decide >>

```toml
name = "file-path-decide"

role = "conformance commitment"
path"
phase = "decide"
glyph = "◇"
```

## Decide

Decide commits to one conformance posture and names repair paths for any failures.

<<~ ahu #migration-procedure >>

### Migration Procedure

A meme migrates from flat-file to path-directory form when it acquires child memes, sidecar data, or support code that warrants a dedicated directory.

**Migration steps (in order):**

1. **Create the directory** at `install-root + ha-ka-ba/name/`
2. **Move the file** via `git mv` from `<meme-type>-<name>.md` into `name/<meme-type>-<name>.md`
3. **Update `file-path`** in `#iam` from the flat-file form to the path-directory form
4. **Verify URI agreement** — the document opener `lar:` URI must not change
5. **Record resolution tension honestly** — local derivation may now miss until a live MCP resolver exists

Steps 3–4 count as Act-phase preparation. Step 2 counts as the Hoʻoko crossing in the current law. The `lar:` URI MUST NOT change at any step.

**The derivation algorithm after migration:**

After migration, an agent running the derivation algorithm may derive the flat-file candidate path at step 7 and find it absent. That miss now surfaces as an explicit resolution tension rather than hiding behind a handwritten registry. The roadmap points toward a live MCP resolver. See `lar:///v0.1/ha.ka.ba/pono/loci#mcp-resolution-roadmap`.

<<~/ahu >>

### Decide Subloops

<<~ ahu #decide-ha >>

#### Decide / ha

Decide-ha holds the commitment domain: one form verdict, one agreement verdict. These remain independent. A meme may carry a correctly classified path-directory `file-path` that still fails URI agreement (e.g. the `lar:` URI accidentally changed during migration). Both verdicts surface separately.

<<~/ahu >>

<<~ ahu #decide-ka >>

#### Decide / ka

Decide-ka governs verdict procedure: form verdict comes first (flat-file, path-directory, malformed, or transitional?), then filename component check, then URI agreement. A malformed verdict supersedes all subsequent checks — no agreement verdict exists for a value that does not parse as a path.

<<~/ahu >>

<<~ ahu #decide-ba >>

#### Decide / ba

Decide-ba governs migration-posture commitment: do not call a meme "migrated" until both the `file-path` value and the physical file agree on the path-directory form. A meme whose `file-path` says path-directory but whose file still lives at the flat-file path counts as transitional, not migrated. Transitional counts as a distinct verdict with a specific repair path: complete the `git mv`.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #act >>

```toml
name = "file-path-act"

role = "repair and report preparation"
phase = "act"
glyph = "▶"
```

## Act

Act prepares the conformance report and any repair or migration guidance for Hoʻoko or the calling agent.

### Canonical Repair Paths

| Verdict | Repair |
|---|---|
| `file-path` absent | Add `file-path = "v0.1/ha-ka-ba/[subpath/]<meme-type>-<name>.md"` as second field in `#iam`, immediately after `name` |
| Filename component wrong | Rename file and update `file-path` to `<meme-type>-<name>.md` pattern |
| URI agreement violation | Derive expected `lar:` URI from `file-path` using the reversed derivation; update the document opener to match |
| Transitional (file not moved) | Complete `git mv` to move file to path declared in `file-path` |
| Local derivation miss after migration | Keep opener and `file-path` coherent; surface MCP-resolution backlog rather than fabricating a registry |

### Act Subloops

<<~ ahu #act-ha >>

#### Act / ha

Act-ha holds the output domain: a conformance report with exactly one form verdict, one agreement verdict, one migration posture verdict, and zero or more repair paths. Act may not execute any repair — that belongs to Hoʻoko. Act prepares the repair paths as stated procedures.

<<~/ahu >>

<<~ ahu #act-ka >>

#### Act / ka

Act-ka governs report assembly: emit verdicts in order (form → filename → agreement → migration posture), then emit repair guidance for each failure, then prepare migration steps on request for migration crossing. The return envelope should reflect the highest-severity verdict: malformed `file-path` produces a degraded envelope regardless of other verdicts.

<<~/ahu >>

<<~ ahu #act-ba >>

#### Act / ba

Act-ba governs execution restraint: Act stages migration steps but does not perform them. An agent that receives staged migration steps from Act should confirm before proceeding to Hoʻoko, because migration involves a `git mv` (a state-changing operation). It should not fabricate extra registry writes to mask the current resolver gap.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #hooko >>

```toml
name = "file-path-hooko"

role = "file-path mutation threshold"
phase = "hooko"
glyph = "⤴"
```

## Hoʻoko

Hoʻoko crosses the mutations Act staged: the `git mv`, the `file-path` update in `#iam`, and any document opener correction.

Each of these counts as a distinct crossing. Hoʻoko should perform them in the order stated in the migration procedure at `#migration-procedure` and record each in the transaction trace. A partial migration — where some crossings complete but others do not — leaves the meme in a transitional state. Aftermath should surface any incomplete crossings as named residue.

### Hoʻoko Subloops

<<~ ahu #hooko-ha >>

#### Hoʻoko / ha

Hoʻoko-ha holds the mutation boundary: what Hoʻoko may alter and what it may not. It may move files, update `file-path` values, and correct document openers. It may not change the `lar:` URI — address stability law at `lar:///v0.1/ha.ka.ba/pono/loci#address-stability` locks that surface. A Hoʻoko that changes the `lar:` URI violates loci kānāwai (law).

<<~/ahu >>

<<~ ahu #hooko-ka >>

#### Hoʻoko / ka

Hoʻoko-ka governs execution order: (1) `git mv` the file; (2) update `file-path` in `#iam` of the moved file; (3) verify opener coherence and physical-file agreement. Each step depends on the previous. Do not claim the open resolution tension resolves if only the carrier mutation completed.

<<~/ahu >>

<<~ ahu #hooko-ba >>

#### Hoʻoko / ba

Hoʻoko-ba governs landing pressure: a `git mv` remains irreversible without a second `git mv`. An agent performing a migration crossing should confirm the target path before executing. If migration stalls between steps, Aftermath must surface exactly which steps completed so a human operator can resume from the correct point.

<<~/ahu >>

<<~/ahu >>

<<~ ahu #aftermath >>

```toml
name = "file-path-aftermath"

role = "file-path evaluation and sync judgment"
phase = "aftermath"
glyph = "↺"
```

## Aftermath

Aftermath judges completeness and surfaces any residue the migration left open.

### Aftermath Kānāwai (law)

After any `file-path` change — whether a full migration or a simple value correction — Aftermath MUST verify:

1. The physical file exists at `install-root + file-path`
2. The `file-path` value in `#iam` matches the physical file location
3. The document opener `lar:` URI remains unchanged and coherent with the moved carrier
4. Any local derivation miss after migration surfaces honestly as resolver backlog

If any of the four checks fails, Aftermath surfaces it as named residue with the specific divergence and repair path.

### Aftermath Subloops

<<~ ahu #aftermath-ha >>

#### Aftermath / ha

Aftermath-ha holds the residue domain: what remains inconsistent after all crossings. Residue does not equal failure; it names addressable unresolved tension. A meme with one incomplete migration crossing carries one residue item. Aftermath names it precisely so a human operator or future agent can resolve it without re-investigating from scratch.

<<~/ahu >>

<<~ ahu #aftermath-ka >>

#### Aftermath / ka

Aftermath-ka governs the four-check procedure: run all four checks independently, do not short-circuit on first failure. A meme may carry both a `file-path`/physical-file disagreement and an open resolver tension simultaneously. Both should surface in residue. Running all four checks produces the minimum residue list needed to fully repair the meme state.

<<~/ahu >>

<<~ ahu #aftermath-ba >>

#### Aftermath / ba

Aftermath-ba governs landing quality: aftermath that ends without a coherence judgment reads as incomplete. Even when all four checks pass, Aftermath should state that outcome explicitly rather than leaving the result implicit. A passing aftermath still yields a typed result.

<<~/ahu >>

<<~/ahu >>

<<~&#x0003; ahu #body-close >>
file-path closes the key-authority stream here.
<<~/ahu >>

<<~ ahu #edges >>

## Edges

- `lar:///v0.1/ha.ka.ba/pono/loci/iam`
- `lar:///v0.1/ha.ka.ba/pono/memetic-wikitext`
- `lar:///v0.1/ha.ka.ba/pono/loci`
- `lar:///v0.1/ha.ka.ba/pono/meme`

<<~/ahu >>


<<~&#x0004; --> ? >>
