/**
 * persona-new-standing-face-route — `persona new N` on a face that already stands asks for NO route (persona-route-rebind): its
 * founding answers `alreadyStood` before any route is read, so a route asked there was parked and thrown away. A face shut under
 * its own route refuses naming the unlock, asking nothing; a founding that stopped midway completes under the face's EXISTING
 * route, asked once through the ward door; only a face not yet founded binds a new route.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let prompts: string[] = [];
vi.mock("../src/prompt-secret.js", () => {
  const ask = (label: string): Promise<string> => { prompts.push(label); return Promise.resolve("the-one-passphrase"); };
  return { canPromptSecret: () => true, promptLine: async (l: string) => { prompts.push(l); return "p"; }, promptSecret: ask, promptSecretConfirmed: ask, readWardPassphrase: ask };
});
const frames: Array<Record<string, unknown>> = [];
let census = { open: [0, 1] as number[], shut: [] as number[] };
vi.mock("../src/custody-door.js", async (real) => ({
  ...(await real<typeof import("../src/custody-door.js")>()),
  sendCustodyFrame: async (frame: Record<string, unknown>) => { frames.push(frame); return { op: frame["op"], ref: "route-ref" }; },
  houseFaces: async () => census,
}));
let roots: Array<{ handleIndex: number; verifyingKey: string; group: string | null }> = [];
vi.mock("../src/sealed-records.js", async (real) => ({
  ...(await real<typeof import("../src/sealed-records.js")>()),
  readPersonaRoots: async () => ({ roots, orphans: [] }),
}));
let ordinals: number[] = [];
let entryStands = true;
vi.mock("@lararium/node", async (real) => ({
  ...(await real<typeof import("@lararium/node")>()),
  listFaceOrdinals: () => ordinals,
  faceStands: () => true,
  compartmentStands: () => entryStands,
}));

let routeForPersonaNew: typeof import("../src/commands/persona.js").routeForPersonaNew;
let seatNewFaceRoute: typeof import("../src/face-route-prompt.js").seatNewFaceRoute;
let node: typeof import("@lararium/node");
beforeAll(async () => {
  vi.resetModules();
  ({ routeForPersonaNew } = await import("../src/commands/persona.js"));
  ({ seatNewFaceRoute } = await import("../src/face-route-prompt.js"));
  node = await import("@lararium/node");
});

const vessel = { reading: "vessel", unlocked: true, composing: false } as const;
beforeEach(() => {
  prompts = []; frames.length = 0;
  census = { open: [0, 1], shut: [] };
  roots = [{ handleIndex: 0, verifyingKey: "k0", group: "g0" }, { handleIndex: 1, verifyingKey: "k1", group: "g1" }];
  ordinals = [0, 1]; entryStands = true;
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  node.seatFaceRoute(null);
  seatNewFaceRoute();
});

describe("RED persona new on a standing face asks for no route", () => {
  it("★ `persona new 1 --handle X` on a standing face asks nothing and hands no route ★", async () => {
    expect(await routeForPersonaNew(1, vessel)).toBeUndefined();
    expect(prompts).toEqual([]);
    expect(frames).toEqual([]);
  });

  it("a face that stands shut refuses naming its unlock, and asks nothing", async () => {
    census = { open: [0], shut: [1] };
    await expect(routeForPersonaNew(1, vessel)).rejects.toThrow(/vault unlock --face 1/);
    expect(prompts).toEqual([]);
    expect(frames).toEqual([]);
  });

  it("a founding stopped midway asks the face's EXISTING route once, through the ward door, never a new-route bind", async () => {
    entryStands = false;
    expect(await routeForPersonaNew(1, vessel)).toBe("route-ref");
    expect(prompts).toHaveLength(1);
    expect(prompts.join("\n")).not.toMatch(/bind/);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ op: "face-route", purpose: "persona-new" });
    expect((frames[0]!["slots"] as Array<{ pins: Array<{ kind: string; passphrase: string }> }>)[0]!.pins).toEqual([{ kind: "passphrase", passphrase: "the-one-passphrase" }]);
  });

  it("CONTROL: a face not yet founded still binds a route of its own", async () => {
    ordinals = [0];
    expect(await routeForPersonaNew(2, vessel)).toBe("route-ref");
    expect(prompts.length).toBeGreaterThan(0);
    expect(frames.at(-1)).toMatchObject({ op: "face-route", purpose: "persona-new" });
  });

  it("CONTROL: no vessel standing hands no route over a door (the founding asks in its own process)", async () => {
    ordinals = [0];
    expect(await routeForPersonaNew(2, { reading: "none" })).toBeUndefined();
    expect(frames).toEqual([]);
  });
});
