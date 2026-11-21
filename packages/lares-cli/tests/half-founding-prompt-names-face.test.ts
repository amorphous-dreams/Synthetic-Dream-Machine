/**
 * half-founding-prompt-names-face — a founding that stopped midway completes under the route the face ALREADY binds, and the
 * prompt names THAT face ("h1's passphrase"), not the worn one. The ward gatherer the binary seats carries the face through.
 * The test drives the seated gatherer and the real passphrase prompt on a faked terminal; no readWardPassphrase mock.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/custody-door.js", async (real) => ({
  ...(await real<typeof import("../src/custody-door.js")>()),
  sendCustodyFrame: async () => ({ op: "face-route", ref: "route-ref" }),
}));

let seatWardGatherer: typeof import("@lararium/node").seatWardGatherer;
let seatTtyWardGatherer: typeof import("../src/ward-door.js").seatTtyWardGatherer;
let handExistingFaceRouteToVessel: typeof import("../src/face-route-prompt.js").handExistingFaceRouteToVessel;
beforeAll(async () => {
  vi.resetModules();
  ({ seatWardGatherer } = await import("@lararium/node"));
  ({ seatTtyWardGatherer } = await import("../src/ward-door.js"));
  ({ handExistingFaceRouteToVessel } = await import("../src/face-route-prompt.js"));
});

const written: string[] = [];
let restore: Array<() => void> = [];

beforeEach(() => {
  written.length = 0;
  seatWardGatherer(null);
  const stdin = process.stdin as unknown as Record<string, unknown>;
  for (const key of ["isTTY", "setRawMode"]) {
    const had = Object.getOwnPropertyDescriptor(stdin, key);
    restore.push(() => { if (had) Object.defineProperty(stdin, key, had); else delete stdin[key]; });
  }
  Object.defineProperty(stdin, "isTTY", { value: true, configurable: true });
  Object.defineProperty(stdin, "setRawMode", { value: () => process.stdin, configurable: true });
  vi.spyOn(process.stdout, "write").mockImplementation(((s: string) => { written.push(String(s)); return true; }) as never);
  for (const k of Object.keys(process.env)) if (/^LAR(?:ES)?_\w*(?:PASS|WARD)|PASSPHRASE/i.test(k)) vi.stubEnv(k, "");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); for (const r of restore) r(); restore = []; seatWardGatherer(null); });

describe("the half-way founding prompt names the face", () => {
  it("RED: through the seated gatherer the prompt reads `h1's passphrase`, never the worn face's", async () => {
    seatTtyWardGatherer();
    const done = handExistingFaceRouteToVessel(1, "persona-new", { handleIndex: 1 });
    await vi.waitFor(() => expect(written.join("")).toMatch(/passphrase for this one act/));
    process.stdin.emit("data", "the-one-passphrase\n");
    expect(await done).toBe("route-ref");
    const prompt = written.join("");
    expect(prompt).toContain("face h1's passphrase");
    expect(prompt).not.toContain("the worn face's");
  });
});
