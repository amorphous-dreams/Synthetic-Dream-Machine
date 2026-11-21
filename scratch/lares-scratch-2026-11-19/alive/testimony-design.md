# Testimony by door — design (Testimony-Seer: Lares (Tasked Spirit))

Bearing: `lar:///testimony.sealed.crosses/lei-edges/ci-verdict`. Read-only research, 2026-11-19.

## Ground read

- `receipt/<tree>` carries `{kind, tree, checks[], verdict, definitions}` (exact key set, `verifyRiteReceipt`, swarm-tiddlers.ts:419-429) and the place signer signs it under `RITE_RECEIPT_DOMAIN` (`restReceipt`, :454). Canon says it plainly: the receipt **notarises** what the host said, so "any seat that can reach the door can hand a verdict in" (seat-harness.mem, Testimony).
- `returnLei` refuses without a passing receipt and narrows on a `fail` receipt (`swarm-lei-testimony-red`, `lei-narrowed/<cid>`).
- `tools/ci-verdict.mjs` returns GREEN / RED / UNREAD / UNREADABLE for one head as pure functions over `gh` JSON, and `ci-verdict.fixture.json` already holds recorded readings. On `develop` and `main` the CI workflow finishes every run it starts and cancels none. The merge queue moves `develop` to the exact sha it tested.
- The vessel reads trees itself, with no git binary (`git-tree-reader.ts`). It therefore **can hash the workflow files at the tree on its own**, so the `definitions` value no longer has to be taken on a seat's word.
- velocity-testing: the receipt names exactly what ran, and "CI signing the receipt itself retires the override".

## The causal-island boundary (applies to every road)

The **host CLI** stands as the shoreline: `lares rite kukulu` on the operator's machine. Only that process speaks web2 (`gh`, the GitHub API). What crosses the door into the vessel is **bytes the house can judge without GitHub**. The vessel never dials out, and no GitHub ontology (run objects, OIDC, Fulcio) enters the mesh core. The difference between the roads comes down to what those bytes prove on their own.

## Road 1: the host reads, the place notarises

- **What signs:** the place, as it does today. `rite kukulu` runs `ci-verdict --json --head <head>` itself before it begins. GREEN hands `rite-receipt` with `checks = ["ci-run:<id>", "ci-job:<name>"…]` and `verdict=pass`. RED hands `verdict=fail`. UNREAD or UNREADABLE hands nothing, so the begin refuses and every return stays unspent.
- **What the vessel verifies:** the tree (already done). It also derives `definitions` itself as sha-256 over the canonical list of `.github/workflows/*.yml` blob ids at that tree, and refuses a receipt whose definitions differ (`rite-receipt-definitions-differ`).
- **A red:** it narrows, as today.
- **Retiring the override:** this road cannot retire it. The door still believes whoever hands in the bytes. Road 1 only removes the seat's choice from the *ordinary* path.
- **Blast radius (4 files):** `lares-cli/src/rite-kukulu.ts`, `lararium-node/src/commands/rite.ts` (definitions from the tree), `tools/ci-verdict.mjs` (export a reusable `readHead()`), `command-help.ts`.
- **Weight:** about a day of work, works offline only with the override, and gives no cryptographic gain.

## Road 2: CI seals and the vessel verifies

- **What signs:** a **CI witness key**. CI.yml gains a final `testimony` job (`needs:` every job, `if: always()`, only on `push` to develop/main and `merge_group`, inside a GitHub `environment: testimony` that holds the secret). It signs a `ci-verdict` body under a new `CI_VERDICT_DOMAIN`, framed like a floor duty: `{kind, tree, run, jobs:[{name, conclusion}], verdict, definitions}`. It publishes the signed bytes as a run artifact named `testimony-<tree>`. The run already has a checkout, so `git rev-parse HEAD^{tree}` gives the tree.
- **What the vessel verifies:** the seal's signature against a `ci` predicate in the trust. That predicate sits beside `place` and is fed from a **charter/roster record the place signs** (`ci-witness/<key>`), so rotation and revocation are place-signed records and never a code change. The vessel also checks that the tree matches the head's tree and that the definitions match its own hash of the tree's workflow blobs. After that the **place still signs `receipt/<tree>`**, with `checks` taken from the seal's jobs plus `ci-run:<id>`, so `verifyRiteReceipt` and `returnLei` stay unchanged.
- **The asymmetry that retires the override:** a **pass needs a seal, and a fail never does.** `restReceipt` refuses an unsealed `pass` (`rite-receipt-unsealed`) and still accepts an unsealed `fail` from any seat. This follows the house's existing law that a revoke only narrows (unstring asks for no co-sign). After this change a seat can carry testimony and can raise a red, but it cannot manufacture a green.
- **Custody:** GitHub holds the secret, which makes it a web2 custodian. Two things limit the damage. First, the seal gates only *which tree a hand-strung kukulu lei may re-stand*. The lei itself still comes from the ward, so a stolen CI key cannot spend anything without a lei. Second, the environment restricts the secret to protected refs: no fork pull requests and no lane branches.
- **Offline:** verification runs fully offline once the bytes arrive, and fetching them is no harder than fetching the tree itself. A kukulu with no CI reachable falls to the labelled override (below) or, later, to the sampled re-run.
- **AI-operator ruling (walls provisional, "overconstrains"):** Road 2 adds **no wall between operator and house**. The CI key stands as one more witness, not an authority, and the operator's override stays as a named and labelled act. The only path it closes is a *seat* minting a green without saying so.
- **Blast radius (about 9 files):** `lararium-mesh/src/domains.ts`, `swarm-tiddlers.ts` (seal verify, `restReceipt` gate), the trust type and the place-signed `ci-witness` record, `lararium-node/src/commands/rite.ts`, `lares-cli/src/rite-kukulu.ts` (fetch the artifact with `gh run download`), `tools/ci-verdict.mjs` (`--seal`), `.github/workflows/ci.yml` (testimony job and environment), `tools/rite-walk/image-leg.mjs` (its self-made receipt needs a test seal key), and canon (seat-harness Testimony, velocity-testing "Ends when", lei-edges Owed).

### Sigstore inside Road 2 (rejected as the default)

`actions/attest-build-provenance` verified in the vessel would put Fulcio, GitHub OIDC and the Rekor transparency log into the house's trust root, which means web2 PKI ontology inside the stack proper. It also adds a trust-root bundle that goes stale offline. It does buy keyless custody and transparency. Keep it as a later option, not the default.

## Road 3, the hybrid (recommended)

Land **Road 1 first as the bridge, then Road 2's seal over the same path**. Both share one host step, one receipt shape and one vessel check:

1. **3a (one lane):** `rite kukulu` reads the verdict itself, and the vessel derives `definitions` from the tree. The override becomes an explicit flag, `--testimony-override`, which writes `operator-admin-override` into `checks` (velocity-testing already demands that label). Without the flag the host hands only what `ci-verdict` read. From this point the seat stops *choosing*.
2. **3b (one lane, needs the operator to create the key):** the CI testimony job, the place-signed `ci-witness` record, and the gate where an unsealed pass refuses. Once 3b lands, `--testimony-override` still works but rests a receipt the vessel marks `checks: [operator-admin-override]`. The forks below decide whether that receipt still spends.

## Forks, each with a default

1. **The CI key's form.** *Default: a house-native ed25519 key in a GitHub environment secret, named by a place-signed `ci-witness` record.* Alternative: sigstore keyless.
2. **What the override does after 3b.** *Default: it still spends, but only as a head-lei return. A wide lei refuses an override receipt (`swarm-lei-testimony-unsealed`), so a hand green narrows instead of widening.* Alternative: the override retires completely.
3. **Which runs seal.** *Default: every run that completes on develop, main or merge_group, naming exactly the jobs that ran.* A canon-only doorstep run then seals `checks` listing the doorstep jobs alone, and the receipt stays honest about that. Alternative: a required job set that kukulu demands (for example `test`), which would leave canon-only heads with no testimony.
4. **Where the seal rests.** *Default: a run artifact, fetched by the host with `gh run download`.* Alternative: `refs/testimony/<tree>` pushed by CI. That lets a plain git fetch carry it, which suits the house better, but CI then needs push rights.
5. **UNREAD at kukulu time.** *Default: refuse with the lei unspent and say "wait or override".* The host never polls under the 180 s floor and never waits by default (`--wait` opts in and reuses `POLL_FLOOR_S`).
6. **Unsealed fail.** *Default: accepted from any seat. A red always narrows.*

## Red-first vectors on existing fixtures

- `tools/ci-verdict.test.mjs` with `ci-verdict.fixture.json`: `bridge-unread-hands-nothing`, `bridge-red-hands-fail`, `bridge-green-names-run-and-jobs` (a pure function from reading to receipt args).
- `lararium-mesh/tests/receipt-door.test.ts`: `receipt-pass-needs-ci-seal`, `receipt-fail-needs-no-seal`, `seal-names-another-tree-refuses`, `seal-key-not-in-roster-refuses`, `override-receipt-spends-head-only` (fork 2). The existing `one-receipt-serves-every-lent-face` must stay green.
- `lararium-mesh/tests/lei-reach.test.ts`: `lei-red-narrows-to-head` carried over with a sealed fail and an unsealed fail.
- `lararium-node/tests/git-tree-reader.test.ts`: `definitions-hash-the-tree-workflows` (the vessel derives the hash, and a seat-supplied mismatch refuses).
- `lararium-node/tests/rite-verbs.test.ts`: three lent faces return on one **sealed** place receipt.
- `tools/rite-walk/image-leg.mjs`: the walk's receipt step signs with a fixture CI key that its scratch house's roster names.

## Recommendation

Take **Road 3**. 3a lands now inside the velocity-testing law and makes the seat stop choosing. 3b retires the override by asymmetry: CI seals greens, any seat may raise reds, and the place notarises both. The web2 shoreline stays at the host CLI, and the vessel judges only bytes. The CI key reads as a witness the place's roster names, never as an authority over the operator.
