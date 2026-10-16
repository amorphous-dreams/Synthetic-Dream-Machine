/**
 * e2e/fleet-join — one face's fleet takes a new vessel of the same human, through the real CLI on two staged roots.
 *
 * A founds its hearth. B founds a PLACE. Three files cross by hand: A's offer, B's request (B's face-scoped keys mint
 * on B), A's answer (the device edge, a certificate and a grant per scope, the gate pin and canon list INSIDE the
 * root's signature, the face's address secret sealed to B's request). B lands the answer, then boots dialing A by
 * the PIN its landing wrote; no environment names A's address, gate or document.
 *
 *   V1 — B stands, bound, and its dial crosses A's gate by the pin the signed answer carried: B's own log reads the
 *        gate's verdict, `crossing open`, and no anergy
 *   V2 — an answer whose pin a carrier moved refuses `answer-admit-other-commit` (the admit commits to the pin), and the landing writes nothing
 *   V3 — the offer names the root's key and the scope the face stands at, and the answer carries one certificate
 *        and one grant there
 *   V5 — the answer names A's lares document beside the gate pin, B's landing keeps it with the pin, and B's dial
 *        asks for it
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
    tag: "fleet-join",
    // The face stands at its own hearth's Nexus, so the offer names one scope and the answer certifies B's key there.
    riteA: async (_cli, rootA) => { stoodAt = await mintStagedNexusKey(rootA); },
    beforeLand: async (cliB, files) => {
      const answer = readJson(files.answer);
      const carriage = answer["carriage"] as { gatePin: Record<string, unknown>; canon: unknown };
      const moved = join(files.answer + ".moved.json");
      writeFileSync(moved, JSON.stringify({ ...answer, carriage: { ...carriage, gatePin: { ...carriage.gatePin, transportKey: "ee".repeat(32) } } }), "utf8");
      bootstrapBefore = bootstrapOf(join(files.answer, ".."));
      tampered = await cliB(["fleet", "join", "land", moved]);
      bootstrapAfterTamper = bootstrapOf(join(files.answer, ".."));
    },
  });
}, 600_000);

afterAll(async () => { await pair?.stop(); });

describe("the fleet-join door, end to end", () => {
  test("V2 — a moved pin refuses `answer-admit-other-commit`, and the landing writes nothing", () => {
    expect(tampered?.code, tampered?.stderr).toBe(1);
    // The admit the answer carries is signed over a commitment to its opening (the full pin), so a moved pin matches no
    // admit and refuses by name at that earlier layer, ahead of the root signature; the landing writes nothing either way.
    expect(tampered?.stderr).toMatch(/answer-admit-other-commit/);
    expect(bootstrapAfterTamper).toBe(bootstrapBefore);
  });

  test("V1 — B lands the answer, stands bound, and crosses A's gate by the signed pin", async () => {
    expect(pair?.admitted.code, `${pair?.admitted.stdout}\n${pair?.admitted.stderr}`).toBe(0);
    expect(pair?.B, pair?.joinGate ?? "").not.toBeNull();
    // The rendezvous says B stands; the crossing is the dial's own verdict line.
    const crossed = "[lar-leaf] verdict OK — crossing open";
    const deadline = performance.now() + 90_000;
    while (!pair!.B!.bootLog().includes(crossed) && !pair!.B!.bootLog().includes("[lar-leaf] ANERGIZED") && performance.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const log = pair!.B!.bootLog();
    expect(log, log.slice(-2000)).toContain(crossed);
    expect(log).not.toContain("[lar-leaf] ANERGIZED");
  }, 120_000);

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
    // The answer carries the FULL sovereign pin (house ruling "The admit's gate pin"), not a bare digest.
    const pin = (answer["carriage"] as { gatePin: Record<string, string> }).gatePin;
    expect(pin["signingKey"]).toMatch(/^[0-9a-f]{64}$/);
    expect(pin["transportKey"]).toMatch(/^[0-9a-f]{64}$/);
    expect(pin["tier"]).toBe("sovereign");
    expect(answer["personaGroup"]).toBe(offer["personaGroup"]);
  });

  test("V5 — the answer names A's lares document beside the gate pin, B keeps it, and B's dial asks for it", async () => {
    const answer = readJson(pair!.fleet!.answer);
    const doc = (answer["edge"] as { islandDocUrl?: unknown }).islandDocUrl;
    expect(doc, "the signed answer names the document").toBe(pair!.laresA);
    expect(String(doc)).toMatch(/^automerge:/);
    expect(bootstrapOf(pair!.rootB), "B's landing keeps the document beside the pin").toContain(String(doc));
    const asked = `nexus dial-out asks peer doc ${String(doc)}`;
    const deadline = performance.now() + 60_000;
    while (!pair!.B!.bootLog().includes(asked) && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 250));
    expect(pair!.B!.bootLog(), pair!.B!.bootLog().slice(-2000)).toContain(asked);
  }, 90_000);

  test("V4 — the same answer lands once: a second landing finds no join pending", async () => {
    const { cliFor } = await import("../harness/instance.js");
    await pair!.B?.stopDaemonOnly();
    const again = await cliFor({ LAR_ROOT: pair!.rootB })(["fleet", "join", "land", pair!.fleet!.answer]);
    expect(again.code).toBe(1);
    expect(again.stderr).toMatch(/join-absent/);
  });
});
