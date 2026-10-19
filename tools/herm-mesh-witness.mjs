// herm-mesh-witness — the decoding witness for docker-compose.mesh.yml. It pulls each hop's FLOW-map
// through the SAME gate-native pull a herm's carriage holds (vesselCarriagePull → pullAndVerifyOracle: presents
// the reader's place arm at the hop's floor gate, at the pin the reader's own board replica filed,
// verifies the pointer signature, matches the content hash, then Automerge.loads the snapshot), enumerates
// the dials the decoded map carries, and proves the source's announced dial crossed the relay chain to the
// last hop.
//
// Why a decoder, not a grep: the read-face serves an Automerge-SAVED snapshot (compressed binary), so a
// raw substring search for a bearing never matches — the earlier curl+grep witness read the wrong format
// and reported a false failure while federation ran green underneath it. This witness decodes, so it reads
// what the map actually carries AND exercises the full pointer-signature/hash/freshness verify path.
//
// Run:  node tools/mesh-pins.mjs --up   (then ./tools/herm-mesh-witness.sh walks each herm and this reader through
//       A's explicit join before the read: a reader carried nowhere holds no floor pin and knocks nowhere)
//        export LAR_ROOT=$(mktemp -d) && node tools/test-scratch-marker.mjs "$LAR_ROOT" && node tools/seed-test-custody.mjs "$LAR_ROOT" \
//          && git ls-files -z genesis/ | xargs -0 -I{} cp --parents "{}" "$LAR_ROOT"/ \\
//          && node packages/lares-cli/bin/lares.mjs vessel found --skip-build
//       node tools/herm-mesh-witness.mjs
// Env:  LAR_ROOT names the founded READER vessel (peers prove first); HOP_SOURCE / HOP_RELAY1 / HOP_RELAY2
//       override the hop URLs (`<url>#<publisher key>`); NEEDLE overrides the carried bearing. By default each hop
//       pins the publisher key `tools/mesh-pins.mjs` read off that herm's own store (`.mesh-pins.env`): the vessel key
//       its FLOW-map pointer verifies under. The knock rides the floor pin the carry join filed.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pullHop, dialsOf } from "./herm-mesh-reader.mjs";
import { readPins } from "./mesh-pins.mjs";

// The reader must stand founded: its social bootstrap is the founding's invariant artifact.
if (!process.env.LAR_ROOT || !existsSync(join(process.env.LAR_ROOT, "data", "lares", "vessel", "social-bootstrap.json"))) {
  console.error("ReaderNotFounded: LAR_ROOT holds no vessel identity — stage it (test-scratch-marker, seed-test-custody) and run `vessel found --skip-build` first");
  process.exit(2);
}

const PINS = readPins();
const pinned = (url, name) => (PINS[name] ? `${url}#${PINS[name]}` : url);
const HOPS = [
  { name: "source ", url: process.env.HOP_SOURCE ?? pinned(`http://localhost:${process.env.MESH_PORT_SOURCE ?? "18092"}`, "HERM_SOURCE_PUBLISHER") },
  { name: "relay-1", url: process.env.HOP_RELAY1 ?? pinned(`http://localhost:${process.env.MESH_PORT_RELAY ?? "18091"}`, "HERM_RELAY_PUBLISHER") },
  { name: "relay-2", url: process.env.HOP_RELAY2 ?? pinned(`http://localhost:${process.env.MESH_PORT_RELAY_2 ?? "18093"}`, "HERM_RELAY_2_PUBLISHER") },
];
const NEEDLE = process.env.NEEDLE ?? "node/alpha";
const ATTEMPTS = Number.parseInt(process.env.WITNESS_ATTEMPTS ?? "30", 10);

// One verified read of a hop: returns { ok, cid, dials } or { ok:false, reason }.
async function readHop(url) {
  const r = await pullHop(url);
  if (!r.ok) return { ok: false, reason: r.reason };
  return { ok: true, cid: r.cid, dials: dialsOf(r.doc) };
}

// Poll until the last hop's verified map carries the needle, or the attempts drain.
for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
  const reads = [];
  for (const hop of HOPS) reads.push({ hop, ...(await readHop(hop.url)) });

  const last = reads[reads.length - 1];
  const carriesNeedle = last.ok && last.dials.some((b) => b.includes(NEEDLE));

  if (carriesNeedle) {
    // SAY WHAT GOT CHECKED, never more. The gate above verifies the LAST hop and reads the earlier ones
    // for report — so a banner claiming "verified at each hop" overclaims whenever an earlier hop comes
    // back UNVERIFIED, which it did on real runs. The last-hop gate stands SOUND for the crossing claim
    // (relay-2 can only carry a dial that reached it), but an earlier hop reading UNVERIFIED names
    // HOST-REACHABILITY, never chain integrity — the hops talk to each other over the container network,
    // which no host fetch observes. Two different facts; the banner now keeps them apart.
    const unverified = reads.filter((r) => !r.ok);
    console.log(`✓ WITNESS: "${NEEDLE}" reached the LAST hop, cryptographically verified there:`);
    for (const r of reads) {
      const mark = r.ok ? `${r.dials.length} dials` : `UNVERIFIED from host (${r.reason})`;
      const has = r.ok && r.dials.some((b) => b.includes(NEEDLE)) ? " ← carries the dial" : "";
      console.log(`    ${r.hop.name}  cid=${(r.cid ?? "—").slice(0, 12)}…  ${mark}${has}`);
    }
    console.log("  the mesh-palace MESHES across the astral space — the map relayed blind, three hops,");
    console.log("  the pointer signed, the snapshot hash-matched, the dial decoded.");
    if (unverified.length > 0) {
      console.log(`  BOUND: ${unverified.length} earlier hop(s) answered no HOST fetch, so this run verified`);
      console.log("  the crossing at the last hop ALONE. The dial arriving there proves it crossed; it does");
      console.log("  NOT prove each hop served the host. Read the unverified marks as reachability, not fault.");
    }
    process.exit(0);
  }

  const detail = last.ok ? `relay-2 verified (${last.dials.length} dials) but "${NEEDLE}" not yet carried`
                         : `relay-2 unverified: ${last.reason}`;
  console.log(`  attempt ${attempt}: ${detail} — waiting…`);
  if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 1000));
}

console.error(`✗ WITNESS FAILED: "${NEEDLE}" never reached the last hop, verified, in ${ATTEMPTS} attempts.`);
process.exit(1);
