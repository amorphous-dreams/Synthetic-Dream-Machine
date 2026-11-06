/**
 * ward-cosign-gate — row 7's S3b over the mesh's own composition (`intentPlaneCosignPort`), and the witness that the gate decides
 * through the judge alone. The node and browser vessels run the same table under their own ports
 * (`lararium-node/tests/ward-cosign-gate-node.test.ts`, `lararium-browser/tests/ward-cosign-gate-browser.test.ts`).
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
 */
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { faceIntentVerbs } from "../src/intent-verbs.js";
import { intentPlaneCosignPort } from "../src/ward-cosign-gate.js";
import { wardCosignTable } from "./ward-cosign-table.js";

wardCosignTable({
  name: "mesh", acts: ["lower", "cap", "go"],
  port: ({ group, atom, plane, devices, lineage, aside, unknown, frontier }) => intentPlaneCosignPort({ group, requester: atom, verbs: faceIntentVerbs(), plane,
    face: () => ({ devices, rosterCids: ["admit"], admittedAt: new Map(devices.map((d) => [d, "admit"])), lineage }),
    standing: (k) => (aside.has(k) ? "aside" : unknown.has(k) ? "unknown" : "stands"), frontier: () => (frontier.known ? "known" : "unknown") }),
  root: async (key) => ({ key: key.key, signer: async () => key }),
});

const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("WITNESS: the gate decides through `judgeCosign` and never calls `mayAct`; CONTROL: the effect door still reads `mayAct`", () => {
  const gate = code(src("../src/ward-cosign-gate.ts"));
  expect(gate).toMatch(/judgeCosign\(/);
  expect(gate).not.toMatch(/\bmayAct\b/);
  // the nonsense control: the instrument finds mayAct where it stands
  expect(code(src("../../lararium-keyhive/src/face-intent-door.ts"))).toMatch(/mayAct\(/);
});

test("WITNESS: each co-signed ward act's door runs the gate: the kāpae lower, the house cap and the push go; the share stays ungated", () => {
  const board = code(src("../src/promote-board-door.ts")), swarm = code(src("../src/swarm-door.ts"));
  expect(board).toMatch(/wardCosignGate\(await ports\.cosign\(\), \{ verb: "ward-kapae-lower"/);
  expect(swarm).toMatch(/verb: "ward-house-cap"/);
  expect(swarm).toMatch(/verb: "ward-push-go"/);
  expect(swarm).not.toMatch(/ward-lane-share/);
  // each vessel composition hands its door the port
  expect(code(src("../../lararium-node/src/commands/promote.ts"))).toMatch(/cosign: \(\) => nodeWardCosignPortOf\(/);
  expect(code(src("../../lararium-node/src/commands/swarm.ts"))).toMatch(/cosign: \(\) => nodeWardCosignPortOf\(/);
  expect(code(src("../../lararium-node/src/open-node-vessel.ts"))).toMatch(/cosign: \(\) => loadNodeWardCosignPort\(/);
  expect(code(src("../../lararium-browser/src/open-browser-vessel.ts"))).toMatch(/cosign: browserCosignPortOf,/);
});

test("WITNESS: the browser's co-sign port folds the worn face's persona plane at each act, never the boot's proof; CONTROL: the instrument finds the boot proof where it stands", () => {
  const vessel = code(src("../../lararium-browser/src/open-browser-vessel.ts"));
  const start = vessel.indexOf("const browserCosignPortOf = async () =>");
  expect(start).toBeGreaterThan(-1);
  const body = vessel.slice(start, vessel.indexOf("};", start));
  expect(body).toMatch(/fold: browserFaceFold\(/);
  expect(body).not.toMatch(/proof\.projection/);
  // the nonsense control: the boot's own proof still stands in the vessel, so the instrument reads the right text
  expect(vessel).toMatch(/proof\.projection/);
});
