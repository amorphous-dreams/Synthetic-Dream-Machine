/**
 * sibling-lease-unread — a null face reading refuses the sibling channel; it never floors to epoch 0.
 *
 * Both vessel shores stand their sibling channel through `standSiblingChannel` with the lease epoch their face reading
 * names. Where the reading stands null (the chain folds to no face under the anchor), the shores wrote
 * `readFace(...)?.leaseEpoch(...) ?? 0`: an epoch of 0 licenses every edge bound at or above 0, so a sibling whose
 * lease rolled past it reads current. The cure carries the null through: `expectedEpoch: number | null`, and a null
 * refuses the channel by name (`lease-unread`) beside the shut route, so no edge licenses against a reading nobody made.
 *
 *   L1  RED: a null reading refuses the channel naming `lease-unread`, in status and on the dial's refusal.
 *   L2  RED: neither vessel shore floors a null lease reading to 0 (`leaseEpoch(...) ?? 0` reads nowhere in either source).
 *   L0  CONTROL: a readable reading at the current epoch stands the channel under the shut alone, no lease cause named.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5b) · the custody collision's fail-open row
 */
import { afterEach, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import {
  hex, ed25519SignerFromSeed, standSiblingChannel, enrolDevice, groupSecretOpenerFromSeed,
  provisionThresholdRecoveryAtFounding, recoveryContactRegistrationCard, type PersonaKelEvent, type SiblingRefusal,
} from "../src/index.js";

const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const seed = (b: number) => new Uint8Array(32).fill(b);
const NEXUS = "9b".repeat(32);

async function inceptionOf(): Promise<PersonaKelEvent> {
  const keys = await Promise.all([seed(71), seed(72), seed(73)].map(pubOf));
  const slots = ["mine", "contact-a", "contact-b"] as const;
  return provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: `0x${await pubOf(seed(52))}`,
    recoveryContacts: keys.map((k, i) => recoveryContactRegistrationCard(slots[i]!, k, null)),
    recoveryThreshold: 2,
  }).inception;
}

const repos: Repo[] = [];
afterEach(async () => { for (const r of repos.splice(0)) await r.shutdown(); });

/** Stand the channel at one lease reading (a number, or the null a face reading that folds to nothing hands over). */
async function stand(expectedEpoch: number | null, refusals: SiblingRefusal[]) {
  const repo = new Repo({ network: [], sharePolicy: async () => true });
  repos.push(repo);
  const inception = await inceptionOf();
  const key = await pubOf(seed(56));
  const adapter = await standSiblingChannel({
    repo, herms: [], nexusPubkey: NEXUS, personaKelPrefix: inception.prefix,
    deviceKey: key, sign: ed25519SignerFromSeed(seed(56)),
    enrolment: await enrolDevice({ opSeed: seed(52), prefix: inception.prefix, deviceVerifyingKey: key, hearthTrueName: "", boundEpoch: 1 }),
    open: groupSecretOpenerFromSeed(seed(56)),
    expectedEpoch: () => expectedEpoch,
    onRefusal: (r) => refusals.push(r),
  });
  await adapter.whenReady();
  return adapter;
}

describe("a null face reading refuses the sibling channel by name", () => {
  test("L0 CONTROL: a readable reading at the current epoch names the shut alone, no lease cause", async () => {
    const refusals: SiblingRefusal[] = [];
    const adapter = await stand(1, refusals);
    expect(adapter.status().refusal).toMatch(/^sibling-route-shut/);
    expect(adapter.status().refusal).not.toMatch(/lease-unread/);
    expect(refusals.every((r) => !/lease-unread/.test(r.reason))).toBe(true);
  });

  test("L1 RED: a null reading refuses the channel naming `lease-unread`, in status and on the dial", async () => {
    const refusals: SiblingRefusal[] = [];
    const adapter = await stand(null, refusals);
    expect(adapter.status().refusal).toMatch(/lease-unread/);
    expect(refusals.some((r) => r.stands === false && /lease-unread/.test(r.reason))).toBe(true);
  });

  test("L2 RED: neither vessel shore floors a null lease reading to 0", () => {
    const shores = [
      "../../lararium-node/src/open-node-vessel.ts",
      "../../lararium-browser/src/open-browser-vessel.ts",
    ].map((rel) => ({ rel, src: readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8") }));
    for (const { rel, src } of shores) {
      // The control half of the scan: each shore still stands a sibling channel off a lease reading, so a zero below
      // reads the floor's absence, never a renamed site.
      expect(src, `${rel} stands a sibling channel`).toMatch(/standSiblingChannel\(/);
      expect(src, `${rel} reads a lease epoch for it`).toMatch(/leaseEpoch\(/);
      expect(src.match(/leaseEpoch\([^)]*\)\s*\?\?\s*0\b/g) ?? [], `${rel} floors a null lease reading to 0`).toEqual([]);
    }
  });
});
