/**
 * herm-carriage-log — Gaia Thursday, live: the herm logs what it carries into its public carriage log.
 *
 * Gaia stands a herm at the crossroads and walks away. A sibling leaves a persona-KEL successor drop there, and a member
 * fetches a sealed block from it. Each carriage lands ONE signed receipt in the place's carriage log, keyed by the
 * carriage's own id: the herm restarts on the same journal and still answers "did you carry X" (over its relay port, from
 * the log), and a replayed deposit or a second fetch of the same block appends nothing. A carriage it never took answers
 * with the same silence as every closed door.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  DeterministicFederationGate, attestAndRotate, depositPersonaKelChain, hex, httpPersonaKelDropHerm, makeCarriageLog, placeSignerFromSeed,
  provisionThresholdRecoveryAtFounding, readCarriageReceipt, recoveryContactRegistrationCard, utf8Bytes, type CarriageLog, type PersonaKelEvent,
} from "@lararium/mesh";
import { startHermRelayPort, type HermRelayPort } from "../src/herm-relay-port.js";
import { fileCarriageJournal } from "../src/carriage-log-file.js";
import { decideAndServeWantBlock } from "../src/cas-wire.js";
import { membershipOf, antigenOf, sealABody } from "./cas-test-setup.js";

const seed = (b: number) => new Uint8Array(32).fill(b);
const pubOf = (s: Uint8Array) => ed.getPublicKeyAsync(s).then(hex);
const lines = (path: string) => { try { return readFileSync(path, "utf8").split("\n").filter(Boolean); } catch { return []; } };

async function rotated(): Promise<[PersonaKelEvent, PersonaKelEvent]> {
  const contactSeeds = [seed(61), seed(62), seed(63)];
  const contactKeys = await Promise.all(contactSeeds.map(pubOf));
  const slots = ["mine", "contact-a", "contact-b"] as const;
  const prov = provisionThresholdRecoveryAtFounding({
    foundingOpKeyDid: `0x${await pubOf(seed(51))}`,
    recoveryContacts: contactKeys.map((k, i) => recoveryContactRegistrationCard(slots[i]!, k, null)),
    recoveryThreshold: 2,
  });
  const rot = await attestAndRotate({
    head: prov.inception, freshOpKeyDid: `0x${await pubOf(seed(52))}`, recoveryContactKeys: contactKeys, recoveryThreshold: 2,
    recoveryContactSigners: await Promise.all(contactSeeds.slice(0, 2).map(async (s) => ({ signer: await pubOf(s), sign: async (b: Uint8Array) => hex(await ed.signAsync(b, s)) }))),
  });
  if (!rot.ok) throw new Error(rot.reason);
  return [prov.inception, rot.event];
}

describe("Gaia Thursday: the herm's carriage log, live", () => {
  const relays: HermRelayPort[] = [];
  const dirs: string[] = [];
  afterEach(async () => {
    for (const r of relays.splice(0)) await r.close();
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const scratch = () => { const d = mkdtempSync(join(tmpdir(), "lar-carriage-log-")); dirs.push(d); return d; };
  const placeLog = (path: string): CarriageLog => makeCarriageLog({ signer: placeSignerFromSeed(seed(40)), journal: fileCarriageJournal(path) });
  const stand = async (log: CarriageLog) => { const r = await startHermRelayPort(seed(85), 0, undefined, { carriageLog: log }); relays.push(r); return r; };
  const askCarried = (r: HermRelayPort, id: string) =>
    fetch(`http://127.0.0.1:${r.port}/carried/${encodeURIComponent(id)}`).then(async (res) => ({ status: res.status, body: await res.json() as unknown }), () => "silence" as const);

  test("a kept drop lands one receipt; the restarted herm answers it from the log; a replayed deposit appends nothing", async () => {
    const path = join(scratch(), "carriage-log.jsonl");
    const [inception, rot] = await rotated();
    const first = await stand(placeLog(path));
    const leaf = () => httpPersonaKelDropHerm(`ws://127.0.0.1:${relays.at(-1)!.port}#${relays.at(-1)!.gatePubKey}`);
    expect((await depositPersonaKelChain([inception, rot], [leaf()])).unanswered).toEqual([]);
    expect(lines(path)).toHaveLength(1);
    await first.close(); relays.splice(relays.indexOf(first), 1);

    const log = placeLog(path);
    const again = await stand(log);
    const answer = await askCarried(again, rot.eventCid);
    expect(answer).not.toBe("silence");
    const receipt = readCarriageReceipt((answer as { body: unknown }).body);
    expect(receipt).toMatchObject({ carriage: rot.eventCid, lane: "persona-kel-drop", place: placeSignerFromSeed(seed(40)).key });

    expect((await depositPersonaKelChain([inception, rot], [leaf()])).unanswered).toEqual([]);
    expect(lines(path)).toHaveLength(1);
    expect(log.receipts()).toHaveLength(1);
    expect(await askCarried(again, "pkel9-neverheard")).toBe("silence");
  }, 20_000);

  test("a served sealed block lands one receipt keyed by its cid; a second fetch appends nothing; a Mu lands none", async () => {
    const path = join(scratch(), "carriage-log.jsonl");
    const log = placeLog(path);
    const { registry, cadDir, installed, cleanup } = sealABody(utf8Bytes("a sealed body the herm carries blind"));
    try {
      const deps = { cadDir, seal: registry.seal, membership: membershipOf(["member-peer"]), antigen: antigenOf([]),
        fedGate: new DeterministicFederationGate("a1b2c3d4e5f6a7b8"), carriageLog: log };
      expect((await decideAndServeWantBlock(deps, "stranger-peer", installed.cid)).kind).toBe("cas-mu");
      expect(lines(path)).toHaveLength(0);
      expect((await decideAndServeWantBlock(deps, "member-peer", installed.cid)).kind).toBe("cas-block");
      expect((await decideAndServeWantBlock(deps, "member-peer", installed.cid)).kind).toBe("cas-block");
      expect(lines(path)).toHaveLength(1);
      expect(placeLog(path).carried(installed.cid)).toMatchObject({ carriage: installed.cid, lane: "cas-block" });
      // The log names the carriage and the place alone: no peer, no payload.
      expect(readFileSync(path, "utf8")).not.toMatch(/member-peer|sealed body/);
    } finally { cleanup(); }
  });
});
