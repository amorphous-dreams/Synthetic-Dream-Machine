/**
 * kel-walk-doors-surface — every door that walks a persona-KEL SAYS what the walk set aside.
 *
 * The one reader (`foldPersonaContests`) lets an event that does not verify move nothing, so a board writer's junk rolls
 * no revocation back. Set aside in silence, though, it would hide that someone wrote it. Each door surfaces it:
 *   · the Binding Gate at boot — on the log and in its result (`boot-daemon-keyhive`, pinned in the node suite);
 *   · the face-grant verifier — in its verdict (`face-grant-record.test`);
 *   · the live admission door (`operator-daemon-behavior` `verifyPeer`) — in the verdict's provenance, through
 *     `kelWalkNote`, pinned here both by behaviour and by the door's own source.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildDeviceDelegation, ed25519VerifyingKeyFromSeed, mintPersonaInception, enrolmentDigestOf, personaEventCidOf,
  verifyEdgeAgainstPersonaKel, type PersonaKelEvent,
} from "@lararium/mesh";
import { kelWalkNote } from "../src/operator-daemon-behavior.js";

const ROOT = new Uint8Array(32).fill(7);

describe("the live admission door says what the KEL walk set aside", () => {
  test("RED: a junk event beside the chain lands in the verdict's note; CONTROL: a clean walk notes nothing", async () => {
    const rootDid = `0x${await ed25519VerifyingKeyFromSeed(ROOT)}`;
    const inception = mintPersonaInception(rootDid, "rs");
    const core = {
      seq: 1, prefix: inception.prefix, opKeyDid: `0x${"ee".repeat(32)}`, recoverySetHash: inception.recoverySetHash,
      nextRecoverySetHash: inception.nextRecoverySetHash, prevEventCid: inception.eventCid, provisional: false, vetoOfCid: null,
      enrolmentDigest: enrolmentDigestOf([]),
    };
    const junk: PersonaKelEvent = { ...core, eventCid: personaEventCidOf(core), recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [] };
    const edge = await buildDeviceDelegation({ personaRootSeed: ROOT, deviceVerifyingKey: "6".repeat(64), hearthTrueName: "", boundEpoch: 0 });
    const planted = await verifyEdgeAgainstPersonaKel(edge, [inception, junk], { expectedEpoch: 0 });
    expect(planted.ok).toBe(true);
    expect(kelWalkNote(planted)).toMatch(new RegExp(`set aside: .*${junk.eventCid.slice(0, 16)}`));
    expect(kelWalkNote(await verifyEdgeAgainstPersonaKel(edge, [inception], { expectedEpoch: 0 }))).toBe("");
  });

  test("the door threads the note into BOTH its admit and its refusal", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "operator-daemon-behavior.ts"), "utf8");
    expect(src).toMatch(/const unreadNote\s*=\s*kelWalkNote\(delegation\)/);
    expect(src).toMatch(/reason: `admitted via operator device-delegation\$\{unreadNote\}`/);
    expect(src).toMatch(/"device-delegation requires a verified proof-of-possession"\) \+ unreadNote/);
  });
});
