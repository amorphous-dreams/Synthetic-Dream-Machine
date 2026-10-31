/**
 * sibling-channel-stand.test — `standSiblingChannel`, the ONE composition both vessel shores call: THE SIBLING DIAL SHIPS
 * SHUT BY NAME.
 *
 * The shut-routes house ruling (stable-founding-road #/rulings): "Walker arms, the sibling dial and the herm membership relay ship SHUT by name ...
 * a closed route grants no silent legacy authority." Never skipped to get green: a shut route's test asserts the shut.
 * The adapter's own laws (proof, sessions, rotation, degraded, tolerance) stand in mesh `sibling-channel.test.ts` over a
 * transport double; here the dial is asserted shut.
 *
 *   · RED: with real, live herms pinned under distinct gate keys, the channel dials NOTHING (the herms see no socket),
 *     says `sibling-route-shut` as `pins` (stands false) on every dial and in its status, and never throws;
 *   · RED: `dialSiblingHerm` opens no socket and rejects with `SIBLING_ROUTE_SHUT`;
 *   · RED: no herm, or an address with no pinned gate key, still refuses the CHANNEL by that cause, beneath the shut.
 */
import { afterEach, describe, test, expect } from "vitest";
import * as net from "node:net";
import * as ed from "@noble/ed25519";
import { Repo } from "@automerge/automerge-repo";
import {
  hex, ed25519SignerFromSeed, standSiblingChannel, enrolDevice, groupSecretOpenerFromSeed, dialSiblingHerm, SIBLING_ROUTE_SHUT,
  provisionThresholdRecoveryAtFounding, recoveryContactRegistrationCard, type PersonaKelEvent, type SiblingRefusal,
} from "@lararium/mesh";
import { startHermRelayPort, type HermRelayPort } from "../src/herm-relay-port.js";

const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);
const seed = (b: number) => new Uint8Array(32).fill(b);
const NEXUS = "9a".repeat(32);

async function inceptionOf(): Promise<PersonaKelEvent> {
  const recoveryContactKeys = await Promise.all([seed(61), seed(62), seed(63)].map(pubOf));
  const slots = ["mine", "contact-a", "contact-b"] as const;
  return provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: `0x${await pubOf(seed(51))}`,
    recoveryContacts: recoveryContactKeys.map((k, i) => recoveryContactRegistrationCard(slots[i]!, k, null)),
    recoveryThreshold: 2,
  }).inception;
}

describe("standSiblingChannel — the sibling dial ships SHUT by name", () => {
  const relays: HermRelayPort[] = [];
  const repos: Repo[] = [];
  afterEach(async () => {
    for (const r of repos.splice(0)) await r.shutdown();
    for (const r of relays.splice(0)) await r.close();
  });

  async function stand(herms: readonly string[], refusals: SiblingRefusal[]) {
    const repo = new Repo({ network: [], sharePolicy: async () => true });
    repos.push(repo);
    const inception = await inceptionOf();
    const key = await pubOf(seed(55));
    const adapter = await standSiblingChannel({
      repo, herms: [...herms], nexusPubkey: NEXUS, personaKelPrefix: inception.prefix,
      deviceKey: key, sign: ed25519SignerFromSeed(seed(55)),
      enrolment: await enrolDevice({ opSeed: seed(51), prefix: inception.prefix, deviceVerifyingKey: key, hearthTrueName: "", boundEpoch: 0 }),
      open: groupSecretOpenerFromSeed(seed(55)), expectedEpoch: 0, onRefusal: (r) => refusals.push(r),
    });
    return adapter;
  }

  test("RED: two live herms pinned under their own gate keys see no socket; the channel says the shut as `pins` on every dial and in status", async () => {
    const live = [await startHermRelayPort(seed(1)), await startHermRelayPort(seed(2))];
    relays.push(...live);
    const refusals: SiblingRefusal[] = [];
    const adapter = await stand(live.map((r) => `ws://127.0.0.1:${r.port}#${r.gatePubKey}`), refusals);
    await adapter.whenReady();
    expect(refusals).toEqual([{ suspect: "pins", stands: false, reason: expect.stringMatching(/^sibling-route-shut/) }]);
    expect(adapter.status()).toMatchObject({ refusal: expect.stringMatching(/^sibling-route-shut/), degraded: null, carried: 0 });
    adapter.connect("again" as never);
    expect(refusals.filter((r) => r.suspect === "pins")).toHaveLength(2);
  });

  test("RED: `dialSiblingHerm` opens no socket and rejects with the shut named", async () => {
    const dials: unknown[] = [];
    const server = net.createServer((c) => { dials.push(c); c.destroy(); });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as net.AddressInfo).port;
    try {
      await expect(dialSiblingHerm({ address: `ws://127.0.0.1:${port}#${"ab".repeat(32)}`, deviceKey: await pubOf(seed(55)), sign: ed25519SignerFromSeed(seed(55)) })).rejects.toThrow(SIBLING_ROUTE_SHUT);
      expect(dials).toEqual([]);
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });

  test("RED: no herm, or an address with no pinned gate key, refuses the CHANNEL beneath the shut — said as `pins` on every dial and in status — and never throws", async () => {
    const gate = (b: number) => b.toString(16).padStart(2, "0").repeat(32);
    for (const [herms, why] of [
      [["ws://127.0.0.1:9", `ws://127.0.0.1:10#${gate(1)}`], /reads no gate key/],
      [[], /pins no herm/],
    ] as const) {
      const refusals: SiblingRefusal[] = [];
      const adapter = await stand(herms, refusals);
      await adapter.whenReady();
      expect(refusals).toEqual([{ suspect: "pins", stands: false, reason: expect.stringMatching(why) }]);
      expect(adapter.status()).toMatchObject({ refusal: expect.stringMatching(/sibling-route-shut/), degraded: null, carried: 0 });
    }
  });
});
