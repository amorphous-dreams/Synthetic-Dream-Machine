/**
 * e2e/fleet-join — one face's fleet takes a new vessel of the same human, through the real CLI on two staged roots.
 *
 * A founds its hearth. B founds a PLACE. Three files cross by hand: A's offer, B's request (B's face-scoped keys mint
 * on B), A's answer (the device edge, a certificate and a grant per scope, the gate pin and canon list INSIDE the
 * root's signature, the face's address secret sealed to B's request). B lands the answer, then boots dialing A by
 * the PIN its landing wrote, with no `LAR_JOIN_*` set.
 *
 *   V1 — B stands, bound, dialing A by the pin the signed answer carried
 *   V2 — an answer whose pin a carrier moved refuses `answer-unsigned`, and the landing writes nothing
 *   V3 — the offer names the root's key and the scope the face stands at, and the answer carries one certificate
 *        and one grant there
 *   V4 — a second landing of the same answer refuses: the first landing cleared the pending join
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { openStagedJoinee, type StagedJoinee, type CliResult } from "../harness/instance.js";
import { mintStagedNexusKey } from "../harness/vessel-key.js";

let pair: StagedJoinee | null = null;
let tampered: CliResult | null = null;
let bootstrapBefore = "";
let bootstrapAfterTamper = "";
let stoodAt: { nexus: string; faceKey: string } | null = null;

const readJson = (path: string): Record<string, unknown> => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
const bootstrapOf = (root: string): string => {
  try { return readFileSync(join(root, "data", "lares", "vessel", "social-bootstrap.json"), "utf8"); } catch { return ""; }
};

beforeAll(async () => {
  pair = await openStagedJoinee({
    tag: "fleet-join", door: "fleet-join", dial: "pin",
    // The face stands at its own hearth's Nexus, so the offer names one scope and the answer certifies B's key there.
    riteA: async (_cli, rootA) => { stoodAt = await mintStagedNexusKey(rootA); },
    beforeLand: async (cliB, files) => {
      const answer = readJson(files.answer);
      const carriage = answer["carriage"] as { gatePin: string; canon: unknown };
      const moved = join(files.answer + ".moved.json");
      writeFileSync(moved, JSON.stringify({ ...answer, carriage: { ...carriage, gatePin: "ee".repeat(32) } }), "utf8");
      bootstrapBefore = bootstrapOf(join(files.answer, ".."));
      tampered = await cliB(["fleet", "join", "land", moved]);
      bootstrapAfterTamper = bootstrapOf(join(files.answer, ".."));
    },
  });
}, 600_000);

afterAll(async () => { await pair?.stop(); });

describe("the fleet-join door, end to end", () => {
  test("V2 — a moved pin refuses `answer-unsigned`, and the landing writes nothing", () => {
    expect(tampered?.code, tampered?.stderr).toBe(1);
    expect(tampered?.stderr).toMatch(/answer-unsigned/);
    expect(bootstrapAfterTamper).toBe(bootstrapBefore);
  });

  test("V1 — B lands the answer and stands bound, dialing A by the signed pin", () => {
    expect(pair?.admitted.code, `${pair?.admitted.stdout}\n${pair?.admitted.stderr}`).toBe(0);
    expect(pair?.B, pair?.joinGate ?? "").not.toBeNull();
  });

  test("V3 — the offer names the root's key and the face's scope, and the answer certifies and grants B's key there", () => {
    const offer = readJson(pair!.fleet!.offer);
    const answer = readJson(pair!.fleet!.answer);
    const request = readJson(pair!.fleet!.request);
    const scopes = offer["scopes"] as Array<{ faceKey: string; nexus: string }>;
    expect(offer["rootKey"]).toMatch(/^[0-9a-f]{64}$/);
    expect(scopes).toEqual([stoodAt]);
    const asked = (request["requests"] as Array<{ vesselFaceKey: string }>).map((q) => q.vesselFaceKey);
    expect((answer["certificates"] as Array<{ vesselFaceKey: string }>).map((c) => c.vesselFaceKey)).toEqual(asked);
    // B's face-scoped key stands apart: neither its vessel key nor the face key.
    expect(asked[0]).not.toBe(request["vesselKey"]);
    expect(asked[0]).not.toBe(stoodAt?.faceKey);
    expect((answer["certificates"] as unknown[]).length).toBe(scopes.length);
    expect((answer["grants"] as unknown[]).length).toBe(scopes.length);
    expect((answer["carriage"] as { gatePin: string }).gatePin).toMatch(/^[0-9a-f]{64}$/);
    expect(answer["personaGroup"]).toBe(offer["personaGroup"]);
  });

  test("V4 — the same answer lands once: a second landing finds no join pending", async () => {
    const { cliFor } = await import("../harness/instance.js");
    await pair!.B?.stopDaemonOnly();
    const again = await cliFor({ LAR_ROOT: pair!.rootB })(["fleet", "join", "land", pair!.fleet!.answer]);
    expect(again.code).toBe(1);
    expect(again.stderr).toMatch(/join-absent/);
  });
});
