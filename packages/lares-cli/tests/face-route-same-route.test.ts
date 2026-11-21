/**
 * K15 Wave D, slice 3: the first founding asks whether persona zero's face tree takes the same typed route as the node tree.
 * The question stands each time with no default and names its cost in one line; either answer leaves the two trees independent.
 */
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import type { SlotSpec } from "@lararium/mesh";

const asked: string[] = [];
let answer = true;
const typed: SlotSpec[] = [{ t: 1, pins: [{ kind: "passphrase", passphrase: "typed-for-the-face" }] }];
vi.mock("../src/custody-prompt.js", () => ({
  askYesNo: async (q: string) => { asked.push(q); return answer; },
  gatherFoundingRoute: async () => typed,
  requireTty: () => {},
}));
vi.mock("../src/offline-custody.js", () => ({ testScratchRoot: () => false, TEST_ROUTE_PASSPHRASE: "x" }));

// The suite's setup file loaded the real prompt layer before this mock registered: reset the graph and load the module fresh.
let gatherNewFaceRoute: typeof import("../src/face-route-prompt.js").gatherNewFaceRoute;
let noteFoundingNodeRoute: typeof import("../src/face-route-prompt.js").noteFoundingNodeRoute;
beforeAll(async () => {
  vi.resetModules();
  ({ gatherNewFaceRoute, noteFoundingNodeRoute } = await import("../src/face-route-prompt.js"));
});
const nodeRoute: SlotSpec[] = [{ t: 1, pins: [{ kind: "passphrase", passphrase: "typed-for-the-node" }] }];

beforeEach(() => { asked.length = 0; vi.spyOn(process.stdout, "write").mockImplementation(() => true); });

describe("the same-route question of the first founding", () => {
  test("RED: yes hands the node route to the face tree; the question names its cost in one line", async () => {
    answer = true;
    noteFoundingNodeRoute(nodeRoute);
    expect(await gatherNewFaceRoute({ label: "persona zero" })).toBe(nodeRoute);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("One credential then opens both");
  });

  test("RED: no asks the face its own route", async () => {
    answer = false;
    noteFoundingNodeRoute(nodeRoute);
    expect(await gatherNewFaceRoute({ label: "persona zero" })).toBe(typed);
    expect(asked).toHaveLength(1);
  });

  test("CONTROL: a face founded after the first asks nothing of the node route, and a founding with no node route noted asks nothing", async () => {
    answer = true;
    noteFoundingNodeRoute(nodeRoute);
    await gatherNewFaceRoute({ label: "persona zero" });
    asked.length = 0;
    expect(await gatherNewFaceRoute({ label: "persona one" })).toBe(typed);
    expect(asked).toHaveLength(0);
  });
});
