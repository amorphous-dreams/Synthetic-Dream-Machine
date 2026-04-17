<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/loci/iam/file_path >>

<<~ ahu #iam >>

```toml
# <<~ ahu #iam-ha "structure" >>
name = "file_path"
file_path = "ha_ka_ba/loci/iam/loci_file_path.md"
description = "Kānāwai (law) for the file_path metadata key. Governs its two canonical forms (flat-file and path-directory), its required agreement with the lar: URI in the document opener, and the migration procedure when a meme moves between forms."
version = "0.1-draft"
tulen = 0.60
confidence = 0.62
mana = 0.60
manao = 0.68
manaoio = 0.52
content_type = "text/x-memetic-wikitext"
meme_type = "loci"
register = "CS"
structure = "OODA-HA * ha.ka.ba"
# <<~/ahu >>
# <<~ ahu #iam-ka "detail" >>
enacts = true
role = "file_path key authority, path-form classifier, and migration-procedure kānāwai (law)"
function = "define the two canonical file_path forms, govern the agreement check between file_path and lar: URI, and declare the migration procedure when a meme moves from flat-file to path-directory siting"
key_name = "file_path"
key_position = "second field in #iam TOML, immediately after name"
path_root = "ha_ka_ba/"
install_root = "lares/"
# <<~/ahu >>
# <<~ ahu #iam-ba "flow" >>
input = "file_path value|#iam TOML block|lar: URI|migration request|?"
output = "file-path-envelope(high manaoio^)|partial-file-path-envelope(mid manaoio-)|degraded-file-path-envelope(low manaoio_)|?(~manaoio?)"
depends_on = [
  "lar:///ha.ka.ba/loci/iam",
  "lar:///ha.ka.ba/pono/memetic-wikitext",
  "lar:///ha.ka.ba/loci",
  "lar:///ha.ka.ba/meme"
]
# <<~/ahu >>
```

<<~/ahu >>

# file_path

A kānāwai (law) for a single `#iam` TOML key.

`file_path` carries the path from the `ha_ka_ba` path root to the meme's file on disk, relative to `install_root`. It sits as the second field in every `#iam` block, immediately after `name`. It comes in two canonical forms — flat-file and path-directory — and must agree with the `lar:` URI declared in the document opener.


**Lifecycle Note:** The five-bucket lifecycle (noise → data → meme → typed meme → canon typed meme) remains canonical for all meme law. Here `data` names structured language an AI can use without the memetic wrappers. This law governs only the file_path key and its agreement, not lifecycle stages.

<<~ ala lar:///ha.ka.ba/loci/iam/file_path >>

## Supported Queries

<<~&#x0005; ui meme? -> lar:///ha.ka.ba/loci/iam/file_path#iam >>
<<~&#x0005; ui forms? -> lar:///ha.ka.ba/loci/iam/file_path#file-path-forms >>
<<~&#x0005; ui agreement? -> lar:///ha.ka.ba/loci/iam/file_path#uri-agreement >>
<<~&#x0005; ui migration? -> lar:///ha.ka.ba/loci/iam/file_path#migration-procedure >>
<<~&#x0005; ui result? -> lar:///ha.ka.ba/loci/iam/file_path#result >>

<<~&#x0002; ahu #meme-body-open >>
file_path opens the key-authority stream here.
<<~/ahu >>

<<~ ahu #phase-map >>

## Phase Map

`✶ Observe -> ⏿ Orient -> ◇ Decide -> ▶ Act -> ⤴ Hooko -> ↺ Aftermath`

file_path kānāwai (law) captures the raw key value from the `#iam` block, classifies it into its canonical form and checks agreement with the `lar:` URI, decides conformance verdict and migration posture, prepares any repair guidance, crosses any migration update, and judges residue including live-resolution tension.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-phase-map >> -->
<<~/ahu >>

<<~ ahu #observe >>

```toml
name = "file_path-observe"
description = "Observe phase for raw file_path value capture from the #iam TOML block."
role = "key value intake"
function = "locate the file_path key in #iam, capture its raw string value, and note the document opener lar: URI for later agreement check"
input = "#iam TOML block|meme surface|?"
output = "raw file_path value|document opener lar: URI|meme name"
phase = "observe"
glyph = "✶"
```

## Observe

Observe locates and captures the raw `file_path` value before any classification or agreement check begins.

Observe should detect:

* the `file_path` key in the `#iam` TOML block and its raw string value
* its position in the TOML key sequence — which MUST sit second, immediately after `name`
* the `lar:` URI from the document opener (`<<~&#x0001; ...`)
* the `meme_type` value (needed for agreement check in Orient)
* the `name` value (needed to verify the filename component)

Observe should not:

* classify the form (flat-file vs path-directory) before Orient
* check agreement before Orient
* flag position errors before Orient classifies the correct position

### Observe Subloops

<<~ ahu #observe-ha >>

#### Observe / ha

Observe-ha holds the intake identity: `file_path` counts as a path string, not a URI and not a name. Its value begins with the path root segment (`ha_ka_ba/`) and ends with a filename (`meme_type.name.md` or similar). Anything outside that shape counts as malformed; capture it as written for Orient to classify.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-observe-ha >> -->
<<~/ahu >>

<<~ ahu #observe-ka >>

#### Observe / ka

Observe-ka governs capture procedure: read the `#iam` TOML block as a whole, locate `file_path` by key name, extract the string value verbatim. Also capture the raw document opener line for the agreement check. Do not normalize or trim at this stage.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-observe-ka >> -->
<<~/ahu >>

<<~ ahu #observe-ba >>

#### Observe / ba

Observe-ba governs noticing posture: a missing `file_path` key counts as a distinct observation from a `file_path` key with an empty value, which counts as distinct again from a key with a value that does not begin with `ha_ka_ba/`. All three cases present differently in Orient. Observe should preserve the distinction.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-observe-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-observe >> -->
<<~/ahu >>

<<~ ahu #orient >>

```toml
name = "file_path-orient"
description = "Orient phase for file_path form classification, URI agreement check, and migration-state assessment."
role = "form classification and agreement mapping"
function = "classify the file_path value into flat-file or path-directory form, check agreement with the lar: URI and meme_type, and assess whether the meme sits in a transitional migration state"
input = "raw file_path value|document opener lar: URI|meme_type|meme name"
output = "form classification|agreement verdict|migration state|open tensions"
phase = "orient"
glyph = "⏿"
```

## Orient

Orient classifies the captured `file_path` value and checks it against the document opener and the derivation algorithm.

<<~ ahu #file-path-forms >>

### Canonical file_path Forms

`file_path` comes in exactly two canonical forms. A value that matches neither counts as malformed.

#### Flat-file form

```
ha_ka_ba/[optional/subpath/]meme_type_name.md
```

Examples:
```
ha_ka_ba/loci_meme.md
ha_ka_ba/pono/loci_parser.md
ha_ka_ba/grammars/grammar_x-tiddlywiki-filter.md
ha_ka_ba/alpha/alpha_test-prompt-00001.md
ha_ka_ba/pono/skill_template.md
```

The meme file sits at `install_root + file_path` as a flat file alongside sibling memes. No child-meme directory accompanies it. New memes default to this form.

#### Path-directory form

```
ha_ka_ba/[optional/subpath/]name/meme_type_name.md
```

Examples:
```
ha_ka_ba/loci/loci_loci.md
ha_ka_ba/meme/loci_meme.md
ha_ka_ba/pono/parser/loci_parser.md   ← (future, if parser migrates)
```

In this form, the meme lives inside its own directory (`name/`), which may hold child memes, child meme directories, and sidecar files alongside the root meme file. The directory name matches the meme `name` field. The root meme file inside that directory keeps the same `meme_type_name.md` filename.

#### Filename component rule

In both forms, the filename component MUST follow the pattern `meme_type_name.md`:
- `meme_type` matches the `meme_type` field in `#iam`
- `name` matches the `name` field in `#iam`
- `meme_type` and `name` join through `_`
- extension always uses `.md`

A filename like `loci_file_path.md` counts as correct for `meme_type = "loci"` and `name = "file_path"`.

A filename like `alpha_test-prompt-00001.md` counts as correct for `meme_type = "alpha"` and `name = "test-prompt-00001"`.

<<~/ahu >>

<<~ ahu #uri-agreement >>

### URI Agreement

`file_path` and the `lar:` URI in the document opener MUST agree. The agreement check follows the derivation algorithm at `lar:///ha.ka.ba/loci#derivation-algorithm`, reversed:

Given a `file_path` value, derive the expected `lar:` URI as follows:

```
1. Strip install_root prefix if present:
     path = file_path.removePrefix("lares/")   → already relative to install_root

2. Strip path_root prefix:
     rest = path.removePrefix("ha_ka_ba/")
     e.g. "loci/iam/loci_file_path.md" or "pono/loci_parser.md"

3. Strip the meme_type_name.md filename:
     filename = rest.split("/").last
     subpath  = rest.split("/")[0..-2].join("/")
     e.g. filename = "loci_file_path.md", subpath = "loci/iam"

4. In path-directory form, subpath ends with the name segment — strip it:
     parts = subpath.split("/")
     if parts.last == name_field:
       subpath = parts[0..-2].join("/")
     e.g. subpath "loci/iam" → derived name "file_path", last part "iam" ≠ "file_path"
     (path-directory check: last part of subpath equals name field)

5. Derive expected lar: URI:
     if subpath == "":
       expected_uri = "lar:///ha.ka.ba/" + name_field
     else:
       expected_uri = "lar:///ha.ka.ba/" + subpath + "/" + name_field
     e.g. "lar:///ha.ka.ba/loci/iam/file_path"
```

If `expected_uri` matches the document opener URI → **agreement holds**.

If they differ → **agreement violation**: a conformance flag that does not abort parsing but MUST surface as named residue.

<<~/ahu >>

### Orient Subloops

<<~ ahu #orient-ha >>

#### Orient / ha

Orient-ha holds the classification domain: what form and agreement mean as the fundamental identity of a `file_path` value. The two forms do not operate as stylistic variations — they signal the meme's siting posture (flat or directory). A meme in flat-file form with a path-directory-style `file_path` counts as inconsistent, not flexible.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-orient-ha >> -->
<<~/ahu >>

<<~ ahu #orient-ka >>

#### Orient / ka

Orient-ka governs the classification and agreement check procedure in order: (1) classify form by testing whether the path contains a `name/meme_type.name.md` segment; (2) verify the filename component matches `meme_type.name.md`; (3) run the URI agreement derivation; (4) assess migration state. All four checks run independently — a form-classification result should not suppress the agreement check.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-orient-ka >> -->
<<~/ahu >>

<<~ ahu #orient-ba >>

#### Orient / ba

Orient-ba governs tension-holding: a meme mid-migration may sit with `file_path` already updated to the path-directory form while the physical file still does not reside at the declared path. Even after the move completes, local derivation may still miss until a live resolver operates. Orient should name these states explicitly rather than flattening them.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-orient-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-orient >> -->
<<~/ahu >>

<<~ ahu #decide >>

```toml
name = "file_path-decide"
description = "Decide phase for conformance verdict, migration-posture commitment, and repair-path selection."
role = "conformance commitment"
function = "commit to a form verdict (flat-file, path-directory, malformed, transitional), issue the URI agreement verdict, and fix the repair path for any failure"
input = "form classification|agreement verdict|migration state|open tensions"
output = "form verdict|agreement verdict|migration posture|repair path"
phase = "decide"
glyph = "◇"
```

## Decide

Decide commits to one conformance posture and names repair paths for any failures.

<<~ ahu #migration-procedure >>

### Migration Procedure

A meme migrates from flat-file to path-directory form when it acquires child memes, sidecar data, or support code that warrants a dedicated directory.

**Migration steps (in order):**

1. **Create the directory** at `install_root + ha_ka_ba/name/`
2. **Move the file** via `git mv` from `meme_type.name.md` into `name/meme_type.name.md`
3. **Update `file_path`** in `#iam` from the flat-file form to the path-directory form
4. **Verify URI agreement** — the document opener `lar:` URI must not change
5. **Record resolution tension honestly** — local derivation may now miss until a live MCP resolver exists

Steps 3–4 count as Act-phase preparation. Step 2 counts as the Hooko crossing in the current law. The `lar:` URI MUST NOT change at any step.

**The derivation algorithm after migration:**

After migration, an agent running the derivation algorithm may derive the flat-file candidate path at step 7 and find it absent. That miss now surfaces as an explicit resolution tension rather than hiding behind a handwritten registry. The roadmap points toward a live MCP resolver. See `lar:///ha.ka.ba/loci#mcp-resolution-roadmap`.

<<~/ahu >>

### Decide Subloops

<<~ ahu #decide-ha >>

#### Decide / ha

Decide-ha holds the commitment domain: one form verdict, one agreement verdict. These remain independent. A meme may carry a correctly classified path-directory `file_path` that still fails URI agreement (e.g. the `lar:` URI accidentally changed during migration). Both verdicts surface separately.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-decide-ha >> -->
<<~/ahu >>

<<~ ahu #decide-ka >>

#### Decide / ka

Decide-ka governs verdict procedure: form verdict comes first (flat-file, path-directory, malformed, or transitional?), then filename component check, then URI agreement. A malformed verdict supersedes all subsequent checks — no agreement verdict exists for a value that does not parse as a path.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-decide-ka >> -->
<<~/ahu >>

<<~ ahu #decide-ba >>

#### Decide / ba

Decide-ba governs migration-posture commitment: do not call a meme "migrated" until both the `file_path` value and the physical file agree on the path-directory form. A meme whose `file_path` says path-directory but whose file still lives at the flat-file path counts as transitional, not migrated. Transitional counts as a distinct verdict with a specific repair path: complete the `git mv`.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-decide-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-decide >> -->
<<~/ahu >>

<<~ ahu #act >>

```toml
name = "file_path-act"
description = "Act phase for conformance report preparation, repair guidance, and migration-step staging."
role = "repair and report preparation"
function = "assemble the conformance report with form and agreement verdicts, stage repair guidance for any failure, and prepare migration steps for Hooko during ongoing migration"
input = "form verdict|agreement verdict|migration posture|repair path"
output = "conformance report|repair guidance|staged migration steps|prepared return-envelope"
phase = "act"
glyph = "▶"
```

## Act

Act prepares the conformance report and any repair or migration guidance for Hooko or the calling agent.

### Canonical Repair Paths

| Verdict | Repair |
|---|---|
| `file_path` absent | Add `file_path = "ha_ka_ba/[subpath/]meme_type.name.md"` as second field in `#iam`, immediately after `name` |
| Filename component wrong | Rename file and update `file_path` to `meme_type.name.md` pattern |
| URI agreement violation | Derive expected `lar:` URI from `file_path` using the reversed derivation; update the document opener to match |
| Transitional (file not moved) | Complete `git mv` to move file to path declared in `file_path` |
| Local derivation miss after migration | Keep opener and `file_path` coherent; surface MCP-resolution backlog rather than fabricating a registry |

### Act Subloops

<<~ ahu #act-ha >>

#### Act / ha

Act-ha holds the output domain: a conformance report with exactly one form verdict, one agreement verdict, one migration posture verdict, and zero or more repair paths. Act may not execute any repair — that belongs to Hooko. Act prepares the repair paths as stated procedures.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-act-ha >> -->
<<~/ahu >>

<<~ ahu #act-ka >>

#### Act / ka

Act-ka governs report assembly: emit verdicts in order (form → filename → agreement → migration posture), then emit repair guidance for each failure, then prepare migration steps on request for migration crossing. The return envelope should reflect the highest-severity verdict: malformed `file_path` produces a degraded envelope regardless of other verdicts.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-act-ka >> -->
<<~/ahu >>

<<~ ahu #act-ba >>

#### Act / ba

Act-ba governs execution restraint: Act stages migration steps but does not perform them. An agent that receives staged migration steps from Act should confirm before proceeding to Hooko, because migration involves a `git mv` (a state-changing operation). It should not fabricate extra registry writes to mask the current resolver gap.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-act-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-act >> -->
<<~/ahu >>

<<~ ahu #hooko >>

```toml
name = "file_path-hooko"
description = "Hooko phase for file migration execution and document opener correction."
role = "file_path mutation threshold"
function = "execute git mv on migration, update file_path in #iam, and correct any agreement violation in the document opener"
input = "staged migration steps|document opener correction"
output = "moved file|updated #iam file_path|updated document opener|transaction trace"
phase = "hooko"
glyph = "⤴"
```

## Hooko

Hooko crosses the mutations Act staged: the `git mv`, the `file_path` update in `#iam`, and any document opener correction.

Each of these counts as a distinct crossing. Hooko should perform them in the order stated in the migration procedure at `#migration-procedure` and record each in the transaction trace. A partial migration — where some crossings complete but others do not — leaves the meme in a transitional state. Aftermath should surface any incomplete crossings as named residue.

### Hooko Subloops

<<~ ahu #hooko-ha >>

#### Hooko / ha

Hooko-ha holds the mutation boundary: what Hooko may alter and what it may not. It may move files, update `file_path` values, and correct document openers. It may not change the `lar:` URI — address stability law at `lar:///ha.ka.ba/loci#address-stability` locks that surface. A Hooko that changes the `lar:` URI violates loci kānāwai (law).

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-hooko-ha >> -->
<<~/ahu >>

<<~ ahu #hooko-ka >>

#### Hooko / ka

Hooko-ka governs execution order: (1) `git mv` the file; (2) update `file_path` in `#iam` of the moved file; (3) verify opener coherence and physical-file agreement. Each step depends on the previous. Do not claim the open resolution tension resolves if only the carrier mutation completed.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-hooko-ka >> -->
<<~/ahu >>

<<~ ahu #hooko-ba >>

#### Hooko / ba

Hooko-ba governs landing pressure: a `git mv` remains irreversible without a second `git mv`. An agent performing a migration crossing should confirm the target path before executing. If migration stalls between steps, Aftermath must surface exactly which steps completed so a human operator can resume from the correct point.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-hooko-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-hooko >> -->
<<~/ahu >>

<<~ ahu #aftermath >>

```toml
name = "file_path-aftermath"
description = "Aftermath phase for migration completeness judgment, carrier-coherence check, and residue surfacing."
role = "file_path evaluation and sync judgment"
function = "judge whether all migration crossings completed, verify carrier coherence and physical-file agreement, and surface any incomplete crossings as named residue"
input = "transaction trace|physical file state|document opener state"
output = "migration completeness verdict|coherence judgment|residue list|next-observation route"
phase = "aftermath"
glyph = "↺"
```

## Aftermath

Aftermath judges completeness and surfaces any residue the migration left open.

### Aftermath Kānāwai (law)

After any `file_path` change — whether a full migration or a simple value correction — Aftermath MUST verify:

1. The physical file exists at `install_root + file_path`
2. The `file_path` value in `#iam` matches the physical file location
3. The document opener `lar:` URI remains unchanged and coherent with the moved carrier
4. Any local derivation miss after migration surfaces honestly as resolver backlog

If any of the four checks fails, Aftermath surfaces it as named residue with the specific divergence and repair path.

### Aftermath Subloops

<<~ ahu #aftermath-ha >>

#### Aftermath / ha

Aftermath-ha holds the residue domain: what remains inconsistent after all crossings. Residue does not equal failure; it names addressable unresolved tension. A meme with one incomplete migration crossing carries one residue item. Aftermath names it precisely so a human operator or future agent can resolve it without re-investigating from scratch.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-aftermath-ha >> -->
<<~/ahu >>

<<~ ahu #aftermath-ka >>

#### Aftermath / ka

Aftermath-ka governs the four-check procedure: run all four checks independently, do not short-circuit on first failure. A meme may carry both a `file_path`/physical-file disagreement and an open resolver tension simultaneously. Both should surface in residue. Running all four checks produces the minimum residue list needed to fully repair the meme state.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-aftermath-ka >> -->
<<~/ahu >>

<<~ ahu #aftermath-ba >>

#### Aftermath / ba

Aftermath-ba governs landing quality: aftermath that ends without a coherence judgment reads as incomplete. Even when all four checks pass, Aftermath should state that outcome explicitly rather than leaving the result implicit. A passing aftermath still yields a typed result.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-aftermath-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-aftermath >> -->
<<~/ahu >>

<<~&#x0003; ahu #body-close >>
file_path closes the key-authority stream here.
<<~/ahu >>

<<~ ahu #result >>

## Result

A lawful file_path envelope from this locus may carry:

* the form verdict (flat-file, path-directory, malformed, or transitional)
* the filename component verdict (meme_type.name.md pattern satisfied or violated)
* the URI agreement verdict (agreement holds or named divergence)
* the migration posture (not migrating, staged, transitional, or complete)
* staged migration steps for Hooko during ongoing migration
* the five-check aftermath verdict with any residue named explicitly

<<~/ahu >>

<<~&#x0004; -> ahu #result >>

```toml
status = "partial"
confidence = 0.62
yield = "loci"
return = "render"
upward_context = "chat"
downward_context = "none"
residue = "sub-meme files (file_path-observe-ha, file_path-orient, etc.) not yet authored; loci/iam/ namespace established but only file_path registered so far"
next_observation = "lar:///ha.ka.ba/loci/iam/file_path#file-path-forms"
next_question = "Which #iam key should the next loci/iam/ sub-meme govern — name, meme_type, or one of the five canonical rating fields?"
```

<<~&#x0004; -> ? >>
