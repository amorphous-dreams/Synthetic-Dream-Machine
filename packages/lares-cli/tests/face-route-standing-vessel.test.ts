/**
 * A new face's route over a standing vessel's door: the door takes a passphrase route alone, so the bind prompt offers the
 * passphrase alone and refuses a sheet BEFORE any sheet prints, never after its read-back. With no vessel standing, the
 * same gatherer still offers the sheet.
 */
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const lines: string[] = [];
const asked: string[] = [];
const said: string[] = [];
const sent: Array<Record<string, unknown>> = [];
vi.mock("../src/prompt-secret.js", () => ({
  canPromptSecret: () => true,
  promptLine: async (label: string) => { asked.push(label); return lines.shift() ?? ""; },
  promptSecret: async (label: string) => { asked.push(label); return "read-back-words"; },
  promptSecretConfirmed: async () => "a-new-face-passphrase",
}));
vi.mock("../src/custody-door.js", () => ({
  sendCustodyFrame: async (frame: Record<string, unknown>) => { sent.push(frame); return { ref: "route-ref" }; },
}));
vi.mock("../src/offline-custody.js", () => ({ testScratchRoot: () => false, TEST_ROUTE_PASSPHRASE: "x" }));

let face: typeof import("../src/face-route-prompt.js");
let node: typeof import("@lararium/node");
beforeAll(async () => {
  vi.resetModules();
  face = await import("../src/face-route-prompt.js");
  node = await import("@lararium/node");
});

beforeEach(() => {
  lines.length = 0; asked.length = 0; said.length = 0; sent.length = 0;
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => { said.push(String(chunk)); return true; });
  node.seatFaceRoute(null);
  face.seatNewFaceRoute();
});

describe("RED a standing vessel's new face asks a passphrase before any sheet prints", () => {
  test("[b]oth and [s]heet refuse at the bind prompt, naming the stopped vessel, and the operator picks the passphrase", async () => {
    lines.push("b", "s", "p");
    expect(await face.handFaceRouteToVessel("h2", "persona-new", { handleIndex: 2 })).toBe("route-ref");
    // NO SHEET PRINTED and no read-back asked: the refusal came at the prompt.
    expect(said.join("")).not.toMatch(/PAPER PIN|sheet 1:/);
    expect(asked.filter((a) => /read sheet/.test(a))).toEqual([]);
    // The bind prompt offered the passphrase alone, and each refused sheet said why and what to do.
    const binds = asked.filter((a) => /bind/.test(a));
    expect(binds).toHaveLength(3);
    for (const b of binds) expect(b).not.toMatch(/\[s\]heet|\[b\]oth/);
    expect(said.join("")).toMatch(/stop the vessel to bind a paper sheet/);
    // The door took the passphrase route alone.
    const slots = sent[0]?.["slots"] as Array<{ pins: Array<{ kind: string }> }>;
    expect(slots.flatMap((s) => s.pins.map((p) => p.kind))).toEqual(["passphrase"]);
  });

  test("CONTROL: with no vessel standing, the same gatherer still offers the sheet", async () => {
    lines.push("p");
    await node.gatherFaceRoute("h3");
    expect(asked.find((a) => /bind/.test(a))).toMatch(/\[s\]heet/);
  });
});
