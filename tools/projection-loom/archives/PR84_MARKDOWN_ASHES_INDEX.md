# Retirement ledger · actual deletions

The source tree no longer contains `tools/projection-loom/docs/ROADMAP.md` (commit `c8fba16f`), `HEPHAESTUS-KANBAN.md` (`db4835bf`), or `BRANCHED_SESSION_HANDOFF.md` (`5623c816`). The older table below retains historical path hyperlinks as provenance, **not active links**. Use `git show 7c644e670390ab51aaa39e9216bb833eb32e6762:<path>` to read exact original content. `HANDOFF.md` remains the human-facing re-entry; `LIVING-PLACE.md` remains a design reference. No canonical `.mem` frame sealing or link-consumer test is claimed for this batch.

---

# Projection Loom · O-takiage ashes · index

**Source commit:** `7c644e670390ab51aaa39e9216bb833eb32e6762` (PR #84, before documentation retirement). **Archive medium:** immutable Git source blobs, not recursively duplicated inline documents. **Status:** Git-indexed, intentionally not yet a canonically sealed Lares `.mem` frame.

The original bytes can be restored directly with `git show <source-commit>:<path>` or `git cat-file blob <blob-sha>`. Never use a current Markdown stub as a replacement for the predecessor's exact content. Blob IDs are Git SHA-1 object identities, not the memetic-wikitext `ni:///sha-256` frame checks.

| Original | Source blob | Semantic material | Current live projection |
|---|---|---|---|
| `tools/projection-loom/docs/HANDOFF.md` | `8b2b9f18f7056bea3acc2172e745381ecba70ebd` | operational front, recursive predecessors | [HANDOFF.md](../docs/HANDOFF.md) |
| `tools/projection-loom/docs/ROADMAP.md` | `461f73f7986bdeb4f0b559a3e48ebd6ac372d0ca` | roadmap, recursive predecessors | [ROADMAP.md](../docs/ROADMAP.md) |
| `tools/projection-loom/docs/HEPHAESTUS-KANBAN.md` | `5859190f90cf0c7583e89a0560259897f3f39d70` | kanban, recursive predecessors | [HEPHAESTUS-KANBAN.md](../docs/HEPHAESTUS-KANBAN.md) |
| `tools/projection-loom/docs/LIVING-PLACE.md` | `e4d16aa26395cea405e20fdc1a67eb957214b9bf` | design evolution and historical contracts | [LIVING-PLACE.md](../docs/LIVING-PLACE.md) |
| `tools/projection-loom/docs/BRANCHED_SESSION_HANDOFF.md` | `e179d1ca3d6c1f7f80605ccc51ba4672517acae5` | session re-entry and previous fronts | [BRANCHED_SESSION_HANDOFF.md](../docs/BRANCHED_SESSION_HANDOFF.md) |

## Live ownership and dissent

- Operational state: `bags/lares/ha.ka.ba/lares/api/projection-loom-handoff.mem`.
- Crew re-entry: `bags/lares/ha.ka.ba/lares/docs/projection-loom-native-inheritance-crew-handoff.mem`.
- Research: `bags/lares/ha.ka.ba/lares/api/projection-loom-research.mem`.
- Architecture and explicit reconstruction-first versus mutation-first dissent: `bags/lares/ha.ka.ba/lares/docs/projection-loom-relational-inheritance-design.mem` and `tools/projection-loom/docs/RELATIONAL-INHERITANCE-DESIGN.md`.
- First census: [PR84_MARKDOWN_OTAKIAGE_CENSUS.md](PR84_MARKDOWN_OTAKIAGE_CENSUS.md).

## Recovery examples

```bash
git show 7c644e670390ab51aaa39e9216bb833eb32e6762:tools/projection-loom/docs/HANDOFF.md > /tmp/PR84-HANDOFF-before-otakiage.md
git cat-file -p 8b2b9f18f7056bea3acc2172e745381ecba70ebd > /tmp/PR84-HANDOFF-blob.md
```

## Held gates

Do not treat Git archival as the completed Lares-native rebind. Consumer census, full source-heading inventory, original research attribution, canonical framing/sealing, and exact-head CI remain independent gates. Never erase unique designs, test narratives, dissent, native STEP receipts, source bodies or lineage. The retired copies are historical operational projections, not design proof.
