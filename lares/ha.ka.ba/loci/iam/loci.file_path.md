<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/loci/iam/file_path >>

<<~ ahu #iam >>

```toml
name = "file_path"
file_path = "ha.ka.ba/loci/iam/loci.file_path.md"
description = "Kānāwai (law) for the file_path metadata key. Governs its two canonical forms (flat-file and path-directory), its required agreement with the lar: URI in the document opener, and the migration procedure when a meme moves between forms."
version = "0.1-draft"
content_type = "text/x-memetic-wikitext"
confidence = 0.62
confidence_band = "CS"
mana = 0.60
manao = 0.68
manaoio = 0.52
meme_type = "loci"
structure = "OODA-HA * ha.ka.ba"
enacts = true
role = "file_path key authority, path-form classifier, and migration-procedure kānāwai (law)"
function = "define the two canonical file_path forms, govern the agreement check between file_path and lar: URI, and declare the migration procedure when a meme moves from flat-file to path-directory siting"
input = "file_path value|#iam TOML block|lar: URI|migration request|?"
output = "file-path-envelope(high manaoio^)|partial-file-path-envelope(mid manaoio-)|degraded-file-path-envelope(low manaoio_)|?(~manaoio?)"
depends_on = [
  "lar:///ha.ka.ba/pono/memetic-wikitext",
  "lar:///ha.ka.ba/loci",
  "lar:///ha.ka.ba/meme"
]
canonical_metadata_locus = "#iam"
canonical_metadata_payload = "toml"
key_name = "file_path"
key_position = "second field in #iam TOML, immediately after name"
path_root = "ha.ka.ba/"
install_root = "lares/"
product_identity = "file_path key kānāwai (law) as used in this system"
```

<<~/ahu >>

# file_path

A kānāwai (law) for a single `#iam` TOML key.

`file_path` carries the path from the `ha.ka.ba` path root to the meme's file on disk, relative to `install_root`. It is the second field in every `#iam` block, immediately after `name`. It exists in two canonical forms — flat-file and path-directory — and must agree with the `lar:` URI declared in the document opener.

This meme does not govern the `name` key, the five rating fields, or the routing derivation algorithm. Those belong to their own kānāwai (law). This meme governs only `file_path`.

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

file_path kānāwai (law) captures the raw key value from the `#iam` block, classifies it into its canonical form and checks agreement with the `lar:` URI, decides conformance verdict and migration posture, prepares any repair guidance, crosses any migration update, and judges residue including routing-table sync.

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
* its position in the TOML key sequence — MUST be second, immediately after `name`
* the `lar:` URI from the document opener (`<<~&#x0001; ...`)
* the `meme_type` value (needed for agreement check in Orient)
* the `name` value (needed to verify the filename component)

Observe should not:

* classify the form (flat-file vs path-directory) before Orient
* check agreement before Orient
* flag position errors before Orient has classified what the correct position would be

### Observe Subloops

<<~ ahu #observe-ha >>

#### Observe / ha

Observe-ha holds the intake identity: `file_path` is a path string, not a URI, not a name. Its value begins with the path root segment (`ha.ka.ba/`) and ends with a filename (`meme_type.name.md` or similar). Anything that does not match this shape is a malformed value, captured as-is for Orient to classify.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-observe-ha >> -->
<<~/ahu >>

<<~ ahu #observe-ka >>

#### Observe / ka

Observe-ka governs capture procedure: read the `#iam` TOML block as a whole, locate `file_path` by key name, extract the string value verbatim. Also capture the raw document opener line for the agreement check. Do not normalize or trim at this stage.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-observe-ka >> -->
<<~/ahu >>

<<~ ahu #observe-ba >>

#### Observe / ba

Observe-ba governs noticing posture: a missing `file_path` key is a distinct observation from a `file_path` key with an empty value, which is distinct again from a key with a value that does not begin with `ha.ka.ba/`. All three present differently in Orient. Observe should preserve the distinction.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-observe-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-observe >> -->
<<~/ahu >>

<<~ ahu #orient >>

```toml
name = "file_path-orient"
description = "Orient phase for file_path form classification, URI agreement check, and migration-state assessment."
role = "form classification and agreement mapping"
function = "classify the file_path value into flat-file or path-directory form, check agreement with the lar: URI and meme_type, and assess whether the meme is in a transitional migration state"
input = "raw file_path value|document opener lar: URI|meme_type|meme name"
output = "form classification|agreement verdict|migration state|open tensions"
phase = "orient"
glyph = "⏿"
```

## Orient

Orient classifies the captured `file_path` value and checks it against the document opener and the derivation algorithm.

<<~ ahu #file-path-forms >>

### Canonical file_path Forms

`file_path` exists in exactly two canonical forms. A value that matches neither is malformed.

#### Flat-file form

```
ha.ka.ba/[optional/subpath/]meme_type.name.md
```

Examples:
```
ha.ka.ba/loci.meme.md
ha.ka.ba/pono/loci.parser.md
ha.ka.ba/grammars/grammar.x-tiddlywiki-filter.md
ha.ka.ba/pono/skill.template.md
```

The meme file sits at `install_root + file_path` as a flat file alongside sibling memes. No child-meme directory exists. This is the default form for new memes.

#### Path-directory form

```
ha.ka.ba/[optional/subpath/]name/meme_type.name.md
```

Examples:
```
ha.ka.ba/loci/loci.loci.md
ha.ka.ba/meme/loci.meme.md
ha.ka.ba/pono/parser/loci.parser.md   ← (future, if parser migrates)
```

The meme has migrated into its own directory (`name/`) which may hold child memes, child meme directories, and sidecar files alongside the root meme file. The directory name matches the meme `name` field. The root meme file inside the directory keeps the same `meme_type.name.md` filename.

#### Filename component rule

In both forms, the filename component MUST follow the pattern `meme_type.name.md`:
- `meme_type` matches the `meme_type` field in `#iam`
- `name` matches the `name` field in `#iam`
- extension is always `.md`

A filename like `loci.file_path.md` is correct for `meme_type = "loci"` and `name = "file_path"`.

<<~/ahu >>

<<~ ahu #uri-agreement >>

### URI Agreement

`file_path` and the `lar:` URI in the document opener MUST agree. The agreement check follows the derivation algorithm at `lar:///ha.ka.ba/loci#derivation-algorithm`, reversed:

Given a `file_path` value, the expected `lar:` URI can be derived:

```
1. Strip install_root prefix if present:
     path = file_path.removePrefix("lares/")   → already relative to install_root

2. Strip path_root prefix:
     rest = path.removePrefix("ha.ka.ba/")
     e.g. "loci/iam/loci.file_path.md" or "pono/loci.parser.md"

3. Strip the meme_type.name.md filename:
     filename = rest.split("/").last
     subpath  = rest.split("/")[0..-2].join("/")
     e.g. filename = "loci.file_path.md", subpath = "loci/iam"

4. In path-directory form, subpath ends with the name segment — strip it:
     parts = subpath.split("/")
     if parts.last == name_field:
       subpath = parts[0..-2].join("/")
     e.g. subpath "loci/iam" → name is "file_path", last part is "iam" ≠ "file_path"
     (path-directory check: last part of subpath equals name field)

5. Derive expected lar: URI:
     if subpath is empty:
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

Orient-ha holds the classification domain: what form and agreement mean as the fundamental identity of a `file_path` value. The two forms are not stylistic variations — they signal the meme's siting posture (flat or directory). A meme in flat-file form with a path-directory-style `file_path` is in an inconsistent state, not a flexible one.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-orient-ha >> -->
<<~/ahu >>

<<~ ahu #orient-ka >>

#### Orient / ka

Orient-ka governs the classification and agreement check procedure in order: (1) classify form by testing whether the path contains a `name/meme_type.name.md` segment; (2) verify the filename component matches `meme_type.name.md`; (3) run the URI agreement derivation; (4) assess migration state. All four checks run independently — a form-classification result should not suppress the agreement check.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-orient-ka >> -->
<<~/ahu >>

<<~ ahu #orient-ba >>

#### Orient / ba

Orient-ba governs tension-holding: a meme mid-migration sits in a state where `file_path` has been updated to the path-directory form but the routing table entry may not yet reflect it, or the physical file may not yet reside at the declared path. Orient should name this transitional state explicitly — it is neither flat-file nor path-directory until both the `file_path` value and the physical file agree.

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

1. **Create the directory** at `install_root + ha.ka.ba/name/`
2. **Move the file** via `git mv` from `meme_type.name.md` into `name/meme_type.name.md`
3. **Update `file_path`** in `#iam` from the flat-file form to the path-directory form
4. **Update the routing table** entry in `lar:///ha.ka.ba/loci#routing-table`: `file_path` value changes; `lar_uri` key does not change
5. **Verify URI agreement** — the document opener `lar:` URI must not change
6. **Verify the routing table** resolves the same `lar:` URI to the new path

Steps 3–5 are Act-phase preparation. Step 4 (routing table write) is a Hooko crossing. The `lar:` URI MUST NOT change at any step.

**The derivation algorithm after migration:**

After migration, an agent running the derivation algorithm will derive the flat-file candidate path at step 7 and find it absent. It falls to step 8 (routing table), which returns the updated path-directory `file_path`. This is the correct and expected behavior. See the live example in `lar:///ha.ka.ba/loci#derivation-algorithm`.

<<~/ahu >>

### Decide Subloops

<<~ ahu #decide-ha >>

#### Decide / ha

Decide-ha holds the commitment domain: one form verdict, one agreement verdict. These are independent. A meme may carry a correctly classified path-directory `file_path` that still fails URI agreement (e.g. the `lar:` URI was accidentally changed during migration). Both verdicts surface separately.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-decide-ha >> -->
<<~/ahu >>

<<~ ahu #decide-ka >>

#### Decide / ka

Decide-ka governs verdict procedure: form verdict comes first (is this flat-file, path-directory, malformed, or transitional?), then filename component check, then URI agreement. A malformed verdict supersedes all subsequent checks — there is no agreement verdict for a value that does not parse as a path.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-decide-ka >> -->
<<~/ahu >>

<<~ ahu #decide-ba >>

#### Decide / ba

Decide-ba governs migration-posture commitment: do not call a meme "migrated" until both the `file_path` value and the physical file agree on the path-directory form. A meme whose `file_path` says path-directory but whose file still lives at the flat-file path is transitional, not migrated. Transitional is a distinct verdict with a specific repair path: complete the `git mv`.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-decide-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-decide >> -->
<<~/ahu >>

<<~ ahu #act >>

```toml
name = "file_path-act"
description = "Act phase for conformance report preparation, repair guidance, and migration-step staging."
role = "repair and report preparation"
function = "assemble the conformance report with form and agreement verdicts, stage repair guidance for any failure, and prepare migration steps for Hooko if migration is in progress"
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
| `file_path` absent | Add `file_path = "ha.ka.ba/[subpath/]meme_type.name.md"` as second field in `#iam`, immediately after `name` |
| Filename component wrong | Rename file and update `file_path` to `meme_type.name.md` pattern |
| URI agreement violation | Derive expected `lar:` URI from `file_path` using the reversed derivation; update the document opener to match |
| Transitional (file not moved) | Complete `git mv` to move file to path declared in `file_path`; update routing table entry |
| Routing table out of sync | Update `file_path` value in routing table `[[route]]` entry for this meme's `lar_uri` |

### Act Subloops

<<~ ahu #act-ha >>

#### Act / ha

Act-ha holds the output domain: a conformance report with exactly one form verdict, one agreement verdict, one migration posture verdict, and zero or more repair paths. Act may not execute any repair — that belongs to Hooko. Act prepares the repair paths as stated procedures.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-act-ha >> -->
<<~/ahu >>

<<~ ahu #act-ka >>

#### Act / ka

Act-ka governs report assembly: emit verdicts in order (form → filename → agreement → migration posture), then emit repair guidance for each failure, then prepare migration steps if a migration crossing is requested. The return envelope should reflect the highest-severity verdict: a malformed `file_path` produces a degraded envelope regardless of other verdicts.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-act-ka >> -->
<<~/ahu >>

<<~ ahu #act-ba >>

#### Act / ba

Act-ba governs execution restraint: Act stages migration steps but does not perform them. An agent that receives staged migration steps from Act should confirm before proceeding to Hooko, because migration involves a `git mv` (a state-changing operation) and a routing table write (a Hooko-only crossing per `lar:///ha.ka.ba/loci`).

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-act-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-act >> -->
<<~/ahu >>

<<~ ahu #hooko >>

```toml
name = "file_path-hooko"
description = "Hooko phase for file migration execution, routing table update, and document opener correction."
role = "file_path mutation threshold"
function = "execute git mv on migration, update file_path in #iam, update the routing table entry, and correct any agreement violation in the document opener"
input = "staged migration steps|routing table update|document opener correction"
output = "moved file|updated #iam file_path|updated routing table entry|updated document opener|transaction trace"
phase = "hooko"
glyph = "⤴"
```

## Hooko

Hooko crosses the mutations Act staged: the `git mv`, the `file_path` update in `#iam`, the routing table write in `lar:///ha.ka.ba/loci#routing-table`, and any document opener correction.

Each of these is a distinct crossing. Hooko should perform them in the order stated in the migration procedure at `#migration-procedure` and record each in the transaction trace. A partial migration — where some crossings complete but others do not — leaves the meme in a transitional state. Aftermath should surface any incomplete crossings as named residue.

### Hooko Subloops

<<~ ahu #hooko-ha >>

#### Hooko / ha

Hooko-ha holds the mutation boundary: what Hooko may alter and what it may not. It may move files, update `file_path` values, update the routing table, and correct document openers. It may not change the `lar:` URI — that is locked by address stability law at `lar:///ha.ka.ba/loci#address-stability`. A Hooko that changes the `lar:` URI has violated loci kānāwai (law).

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-hooko-ha >> -->
<<~/ahu >>

<<~ ahu #hooko-ka >>

#### Hooko / ka

Hooko-ka governs execution order: (1) `git mv` the file; (2) update `file_path` in `#iam` of the moved file; (3) update the routing table entry; (4) verify the derivation algorithm now resolves correctly via step 8. Each step depends on the previous. Do not update the routing table before the file exists at the new path.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-hooko-ka >> -->
<<~/ahu >>

<<~ ahu #hooko-ba >>

#### Hooko / ba

Hooko-ba governs landing pressure: a `git mv` is irreversible without a second `git mv`. An agent performing a migration crossing should confirm the target path before executing. If a migration is interrupted between steps, Aftermath must surface exactly which steps completed so a human operator can resume from the correct point.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-hooko-ba >> -->
<<~/ahu >>

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-hooko >> -->
<<~/ahu >>

<<~ ahu #aftermath >>

```toml
name = "file_path-aftermath"
description = "Aftermath phase for migration completeness judgment, routing-table sync check, and residue surfacing."
role = "file_path evaluation and sync judgment"
function = "judge whether all migration crossings completed, verify routing table and physical file agree, and surface any incomplete crossings as named residue"
input = "transaction trace|physical file state|routing table state|document opener state"
output = "migration completeness verdict|sync judgment|residue list|next-observation route"
phase = "aftermath"
glyph = "↺"
```

## Aftermath

Aftermath judges completeness and surfaces any residue the migration left open.

### Aftermath Kānāwai (law)

After any `file_path` change — whether a full migration or a simple value correction — Aftermath MUST verify:

1. The physical file exists at `install_root + file_path`
2. The `file_path` value in `#iam` matches the physical file location
3. The routing table entry's `file_path` value matches the `#iam` value
4. The document opener `lar:` URI is unchanged and matches the routing table `lar_uri`
5. The derivation algorithm (step 7 or step 8) resolves the `lar:` URI to the correct physical path

If any of the five checks fails, Aftermath surfaces it as named residue with the specific divergence and repair path.

### Aftermath Subloops

<<~ ahu #aftermath-ha >>

#### Aftermath / ha

Aftermath-ha holds the residue domain: what remains inconsistent after all crossings. Residue is not failure — it is named, addressable, unresolved tension. A meme with one incomplete migration crossing has one residue item. Aftermath names it precisely so a human operator or future agent can resolve it without re-investigating from scratch.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-aftermath-ha >> -->
<<~/ahu >>

<<~ ahu #aftermath-ka >>

#### Aftermath / ka

Aftermath-ka governs the five-check procedure: run all five checks independently, do not short-circuit on first failure. A meme may have both a `file_path`/physical-file disagreement and a routing-table disagreement simultaneously. Both should surface in residue. Running all five checks produces the minimum residue list needed to fully repair the meme state.

<!-- OPTIONAL: <<~ ala lar:///ha.ka.ba/loci/iam/file_path-aftermath-ka >> -->
<<~/ahu >>

<<~ ahu #aftermath-ba >>

#### Aftermath / ba

Aftermath-ba governs landing quality: aftermath that ends without a sync judgment is incomplete. Even when all five checks pass, Aftermath should state explicitly that they passed — not leave the result implicit. A passing aftermath is still a typed result.

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
* staged migration steps for Hooko if migration is in progress
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
next_question = "Which #iam key should the next loci/iam/ sub-meme govern — name, meme_type, or one of the five rating fields?"
```

<<~&#x0004; -> ? >>
