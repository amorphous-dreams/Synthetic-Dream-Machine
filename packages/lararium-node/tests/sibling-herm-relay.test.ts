/**
 * sibling-herm-relay.test — the herm's drop floor stands beside the sibling route, which stands shut by name.
 *
 * The herm's relay port carries no channel: an upgrade meets silence (herm-relay-port.test), and the sibling
 * dial refuses by name (sibling-channel-stand.test). Proven here over a real socket:
 *   · the drop floor: a plain request apart from any proven socket reads and keeps a KEL successor that
 *     verifies against the predecessor its deposit carries; an unknown name, a refused deposit and any other
 *     path meet one silence — a cut socket.
 */
import { afterEach, describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import {
  hex, provisionThresholdRecoveryAtFounding, recoveryContactRegistrationCard, attestAndRotate,
  personaKelDropName, httpPersonaKelDropHerm, pullPersonaKelSuccessors,
} from "@lararium/mesh";
import { startHermRelayPort, type HermRelayPort } from "../src/herm-relay-port.js";

const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);

describe("the herm's drop floor stands beside the shut sibling route", () => {
  let relay: HermRelayPort | undefined;
  afterEach(async () => { await relay?.close(); relay = undefined; });

  test("the drop floor: a plain request reads and keeps a KEL successor; every other ask meets one silence", async () => {
    relay = await startHermRelayPort(new Uint8Array(32).fill(88), 0);
    const base = `http://127.0.0.1:${relay.port}`;
    const recoveryContactSeeds = [61, 62, 63].map((b) => new Uint8Array(32).fill(b));
    const recoveryContactKeys = await Promise.all(recoveryContactSeeds.map(pubOf));
    const slots = ["mine", "contact-a", "contact-b"] as const;
    const prov = provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: `0x${await pubOf(new Uint8Array(32).fill(51))}`,
      recoveryContacts: recoveryContactKeys.map((k, i) => recoveryContactRegistrationCard(slots[i]!, k, null)),
      recoveryThreshold: 2,
    });
    const rot = await attestAndRotate({
      head: prov.inception, freshOpKeyDid: `0x${await pubOf(new Uint8Array(32).fill(52))}`, recoveryContactKeys, recoveryThreshold: 2,
      recoveryContactSigners: await Promise.all(recoveryContactSeeds.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, s)) }))),
    });
    if (!rot.ok) throw new Error(rot.reason);
    const name = personaKelDropName(prov.inception.eventCid, relay.gatePubKey);
    /** One request's whole answer: its status, or "silence" when the herm cut the socket. */
    const ask = (path: string, init?: RequestInit) => fetch(`${base}${path}`, init).then(async (r) => ({ status: r.status, body: await r.text(), cors: r.headers.get("access-control-allow-origin") }), () => "silence" as const);
    // An unknown name, another path, a junk deposit and a deposit under the wrong name: one silence each.
    expect(await ask(`/drop/${name}`)).toBe("silence");
    expect(await ask(`/drop/${"0".repeat(64)}`)).toBe("silence");
    expect(await ask("/.well-known/lar")).toBe("silence");
    expect(await ask(`/drop/${name}`, { method: "POST", body: "junk" })).toBe("silence");
    const deposit = JSON.stringify({ prev: prov.inception, event: rot.event });
    expect(await ask(`/drop/${"0".repeat(64)}`, { method: "POST", body: deposit })).toBe("silence");
    expect(await ask(`/drop/${name}`, { method: "POST", body: JSON.stringify(rot.event) }), "a successor with no predecessor").toBe("silence");
    // The lawful deposit keeps, CORS open, and the read answers it.
    expect(await ask(`/drop/${name}`, { method: "POST", headers: { "content-type": "text/plain" }, body: deposit })).toMatchObject({ status: 204, cors: "*" });
    const read = await ask(`/drop/${name}`);
    expect(read).toMatchObject({ status: 200, cors: "*" });
    expect((JSON.parse((read as { body: string }).body) as Array<{ eventCid: string }>).map((e) => e.eventCid)).toEqual([rot.event.eventCid]);
    // A leaf reaches it through its pinned address, and its reader extends the chain.
    const herm = httpPersonaKelDropHerm(`ws://127.0.0.1:${relay.port}#${relay.gatePubKey}`);
    const pulled = await pullPersonaKelSuccessors([prov.inception], [herm]);
    expect(pulled.kel.map((e) => e.eventCid)).toEqual([prov.inception.eventCid, rot.event.eventCid]);
  }, 15_000);
});
