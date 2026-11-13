/**
 * swarm-verbs — the store door names the swarm rows: each acts as a face, the hand-only set carries `swarm-needs-hand` for the three
 * that set or issue, `swarm-show` stays open to a seat, the socket's hand-only table merges the promote and swarm codes, and with no
 * standing daemon wiki every row refuses by name before it loads a face.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { expect, test } from "vitest";
import {
  KAHUA_OPERATOR_ROWS, PROMOTE_HAND_CODES, STORE_DOOR_FACE_ROWS, STORE_DOOR_HAND_CODES, STORE_DOOR_HAND_ONLY_ACTS, STORE_DOOR_VERBS, SWARM_HAND_CODES,
  storeDoorReactors, type StoreDoorDeps,
} from "../src/store-door-verbs.js";

const ROWS = ["swarm-show", "swarm-cap-set", "swarm-share-set", "swarm-go-issue"] as const;

test("RED: every swarm row is a store-door verb that acts as a face; CONTROL: the kahua operator rows stay as they stood", () => {
  for (const row of ROWS) {
    expect(STORE_DOOR_VERBS as readonly string[], row).toContain(row);
    expect(STORE_DOOR_FACE_ROWS.has(row as never), row).toBe(true);
  }
  expect(KAHUA_OPERATOR_ROWS).toEqual(new Set(["kahua-mint", "kahua-lift", "kahua-withdraw", "kahua-carry"]));
});

test("RED: the hand-only swarm rows carry `swarm-needs-hand`; CONTROL: swarm-show is not hand-only", () => {
  expect(Object.fromEntries(SWARM_HAND_CODES)).toEqual({ "swarm-cap-set": "swarm-needs-hand", "swarm-share-set": "swarm-needs-hand", "swarm-go-issue": "swarm-needs-hand" });
  expect(SWARM_HAND_CODES.has("swarm-show")).toBe(false);
});

test("RED: the socket's hand-only table holds the kahua, promote and swarm rows together; CONTROL: the promote codes stand unchanged and the open rows join none", () => {
  for (const row of [...KAHUA_OPERATOR_ROWS, ...PROMOTE_HAND_CODES.keys(), ...SWARM_HAND_CODES.keys()]) expect(STORE_DOOR_HAND_ONLY_ACTS.has(row), row).toBe(true);
  for (const [row, code] of [...PROMOTE_HAND_CODES, ...SWARM_HAND_CODES]) expect(STORE_DOOR_HAND_CODES.get(row), row).toBe(code);
  for (const open of ["swarm-show", "promote-prepare", "kapae-flag", "promote-list", "kahua-propose"]) expect(STORE_DOOR_HAND_ONLY_ACTS.has(open), open).toBe(false);
});

test("RED: with no standing daemon wiki every swarm row refuses by name and loads no face; CONTROL: the refusal rides the row's own name", async () => {
  const deps: StoreDoorDeps = { storageDir: "/tmp/unused", sealHome: "/tmp/unused-seal", repo: {} as StoreDoorDeps["repo"] };
  const rows = storeDoorReactors(deps);
  const worn = { worn: { ordinal: 0 } } as never;
  for (const [row, args] of [["swarm-show", {}], ["swarm-cap-set", { value: 1 }], ["swarm-share-set", { lane: "a", value: 1 }], ["swarm-go-issue", { branch: "b", head: "a".repeat(40) }]] as const) {
    const out = await rows[row](args, worn);
    expect(out["refused"], row).toContain("no standing daemon: swarm controls need the founded wiki");
    expect(out["refusal"], row).toBe(`${row}-refused`);
  }
});
