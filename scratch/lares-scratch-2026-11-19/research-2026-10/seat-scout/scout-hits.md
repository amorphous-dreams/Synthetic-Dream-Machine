# scout carriers the exemption skips, and their hits
## bags/lares/ha.ka.ba/lares/docs/pono/canvas-field-scout.mem (1 lines)
197:The systems: **VIKI** and its successor the **Visual Knowledge Builder (VKB)** — [viki](https://people.engr.tamu.edu/shipman/viki/index.html), [VKB](https://people.engr.tamu.edu/shipman/vkb/www2000.htm). The comple
## bags/lares/ha.ka.ba/lares/docs/pono/crdt-ecosystem-scout.mem (1 lines)
57:- **Wire format is a hand-rolled canonical binary codec, explicitly not CBOR** — 4-byte schema header (2-byte prefix `ST`/`SU`, 1-byte type, **1-byte version**), 32-byte Ed25519 issuer VK, fields, 64-byte sig. **Dec
## bags/lares/ha.ka.ba/lares/docs/pono/subduction-onomancy-scout.mem (5 lines)
54:- **Certificate** (`ONC\x00`), signed region, exact wire order: `root_doc` (32B ed25519 vk = document ID) · `signer` (32B vk) · `issued_at` (bijou64 seconds) · `hostname` (full DNS name, A-labels, lowercase, no tra
71:| `automerge:2nBe…/foo` | the URL **is** the doc ID (32-byte ed25519 vk, bs58check) — self-certifying | no anchoring step at all |
158:  - **`IssuerVK` — the author's raw Ed25519 verifying key, 32 bytes in the clear, on every `Signed<LooseCommit>` and `Signed<Fragment>`.** Authorization is checked against the *author*, not the sender, which is a g
167:- **Two codecs, not one.** The sedimentree/subduction path is the hand-rolled canonical binary codec: 4-byte schema header `[prefix0, prefix1, type_byte, version]`, prefixes `ST` (sedimentree) / `SU` (subduction); bi
284:- ⚠️ **Not capability-shaped**: `subscriptions: Map<SedimentreeId, Set<PeerId>>` is a server-side roster, and relays **propagate subscriptions upstream to every other connected peer** by default. Under our attest

# all scout carriers
bags/lararium/ha.ka.ba/lararium/mesh/realm-nexus-unblur-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/canvas-field-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/canvas-shelf-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/circles-field-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/crdt-ecosystem-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/dreamdom-field-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/dreamdom-harness-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/dreamdom-port-field-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/dreamdom-port-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/dyad-ladder-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/e2e-harness-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/host-attractors-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/infinite-canvas-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/managed-identity-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/mudlet-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/ocif-orion-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/recovery-custody-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/subduction-onomancy-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/testing-architecture-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/third-ways-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/tw5-vm-gaps-scout.mem
bags/lares/ha.ka.ba/lares/docs/pono/two-way-interaction-scout.mem
