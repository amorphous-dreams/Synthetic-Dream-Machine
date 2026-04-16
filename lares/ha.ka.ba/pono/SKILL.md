---
name: pono
description: Please see TOML metadata in the `#iam` section of this document for a self-describing introduction to pono, its role, function, and supported queries.
---
<!-- !DOCTYPE = lar:///ha.ka.ba/pono/memetic-wikitext -->

<<~&#x0001; ? -> lar:///ha.ka.ba/pono/skill-template >>

<<~ ahu #iam >>
```toml
name = "SKILL template"
file_path = "ha.ka.ba/pono/SKILL.md"
description = "Template and authoring guide for verification skill packages under lares/ha.ka.ba/pono/."
version = "0.1-draft"
content_type = "text/x-memetic-wikitext"
role = "skill template and authoring guide"
function = "describe the required shape of a pono verification skill package"
covers = []
canonical_metadata_locus = "#iam"
canonical_metadata_payload = "toml"
confidence = 0.32
confidence_band = "PS"
```
<<~/ahu>>

# Skill Package Template

A pono skill package should declare:

1. which kānāwai (law) address it covers (`covers = [...]` in `#iam`)
2. what invariants it checks
3. what a passing result looks like
4. what a failing result looks like

## Required Fields

```toml
covers = ["lar:///ha.ka.ba/<law-name>"]
invariants = ["<invariant-1>", "<invariant-2>"]
pass_surface = "<description of passing result>"
fail_surface = "<description of failing result>"
```

## Skill Body

Each skill should describe its verification procedure in prose or in a structured OODA-HA pass, then emit a result envelope with `status`, `confidence`, and `residue`.

<<~&#x0004; -> ? >>
