/**
 * share-doors-landing — a share landing rides the worn face's session and keeps it open to the landing's end.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-share-config
 */
import { describe, expect, test } from "vitest";
import { landOnFaceSession, type FaceSession, type LandingPorts } from "../src/share-doors.js";
import { LocalWaitExpired } from "../src/local-connector.js";
import { SessionRefused } from "../src/session-connector.js";

const ports = (): LandingPorts & { slept: number[] } => {
  const slept: number[] = []; let t = 0;
  return { slept, pause: async (ms) => { slept.push(ms); t += ms; }, now: () => t, patienceMs: 5_000 };
};

const sessionOf = (over: Partial<FaceSession>, log: string[] = []): FaceSession => ({
  call: async () => ({ kind: "session:result", status: "done", requestId: "r1", results: {} }),
  receipt: async () => ({ state: "unknown" }),
  close: async () => { log.push("closed"); },
  ...over,
});

describe("landOnFaceSession", () => {
  test("an answer returns as the one-shot's does, and the session closes", async () => {
    const log: string[] = [];
    const r = await landOnFaceSession(async () => sessionOf({}, log), "share-apply", {}, 0, ports());
    expect(r).toMatchObject({ status: "done", requestId: "r1" });
    expect(log).toEqual(["closed"]);
  });

  test("a local wait that ends reads the receipt through the SAME session, and closes only after it settles", async () => {
    const log: string[] = [];
    let reads = 0;
    const session = sessionOf({
      call: async () => { throw new LocalWaitExpired("share-apply", 600_000, "r9"); },
      receipt: async (id) => { log.push(`receipt ${id}`); return ++reads < 3 ? { state: "pending" } : { state: "done", outcome: { results: {} } }; },
    }, log);
    const p = ports();
    const r = await landOnFaceSession(async () => session, "share-apply", {}, 0, p);
    expect(r).toMatchObject({ status: "done", requestId: "r9" });
    expect(log, "reads ride the session, which closes last").toEqual(["receipt r9", "receipt r9", "receipt r9", "closed"]);
    expect(p.slept).toEqual([1000, 1000]);
  });

  test("a shut face reads `face-not-open` (the caller falls back); every other refusal keeps its own name", async () => {
    const shut = await landOnFaceSession(async () => { throw new SessionRefused("face-not-open"); }, "share-apply", {}, 2, ports());
    expect(shut).toMatchObject({ status: "error", refusal: { reason: "face-not-open" } });
    const other = await landOnFaceSession(async () => { throw new SessionRefused("share-needs-hand"); }, "share-apply", {}, 2, ports());
    expect(other).toMatchObject({ status: "error", refusal: { reason: "share-needs-hand" } });
    expect(other.errorMessage).toMatch(/^share-needs-hand:/);
  });

  test("a refusal on the call keeps its name and still closes the session", async () => {
    const log: string[] = [];
    const r = await landOnFaceSession(async () => sessionOf({ call: async () => { throw new SessionRefused("share-needs-hand"); } }, log), "share-apply", {}, 0, ports());
    expect(r.refusal?.reason).toBe("share-needs-hand");
    expect(log).toEqual(["closed"]);
  });

  test("a receipt that names an abandoned landing throws by name, after the session closes", async () => {
    const log: string[] = [];
    const session = sessionOf({ call: async () => { throw new LocalWaitExpired("share-apply", 1, "r7"); }, receipt: async () => ({ state: "abandoned" }) }, log);
    await expect(landOnFaceSession(async () => session, "share-apply", {}, 0, ports())).rejects.toThrow(/request-abandoned/);
    expect(log).toEqual(["closed"]);
  });
});
