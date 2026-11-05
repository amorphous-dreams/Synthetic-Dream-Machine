/**
 * e2e/daemon-island-reopen — a standing vessel re-opens its daemon island in process, and every door stays open across it.
 *
 * The walk (a real staged hearth, the test custody door, the owner-only rendezvous):
 *   R0 CONTROL  the staged vessel's custody reads unlocked, and `island.state` answers its first island (`restarts` 0 and a `leg`).
 *   R1 RED      a marker put through the hand (the CLI session) reads back; `island.restart` answers a NEW `leg`; the SAME
 *               hand reads the marker again from the new island; custody still reads unlocked with no unlock sent.
 *   R2          a loop of restarts keeps answering, each with a leg the island never held before (no stale island answers).
 *   R3 CONTROL  the island stands only through the owner-only door: a frame naming an unknown act refuses by name.
 *
 * `island.restart` and `island.state` ride the custody door's `act` frame (sealed-acts): the owner-only socket and the unlocked
 * holder are the gate, so the kāpae trigger and the operator reach the same door. Boot-input re-resolution (a plugin CID added
 * before the restart shows after it) stands in the node seam test (`daemon-island-reopen.test.ts`), which owns the resolver.
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { targetInstance, awaitRendezvous, vesselStorageDir, type LarInstance } from "../harness/instance.js";
import { sendCustodyFrame } from "../../packages/lares-cli/src/custody-door.js";

const URI = "lar:///ha.ka.ba/t/daemon-reopen/marker";
let lar: LarInstance;
let dataDir: string;
let scratch: string;

const act = async (name: string, args: Record<string, unknown> = {}) =>
  sendCustodyFrame({ op: "act", act: name, args } as never, dataDir) as Promise<Record<string, any> | null>;

beforeAll(async () => {
  lar = await targetInstance();
  if (!(await awaitRendezvous(lar))) throw new Error(`the staged daemon bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
  dataDir = vesselStorageDir(lar);
  scratch = mkdtempSync(join(tmpdir(), "daemon-island-reopen-"));
  mkdirSync(scratch, { recursive: true });
  writeFileSync(join(scratch, "marker.mem"), "the marker the island carries across its re-open\n");
}, 180_000);
afterAll(async () => { rmSync(scratch, { recursive: true, force: true }); await lar?.stop(); });

describe("e2e/daemon-island-reopen", () => {
  test("R0 CONTROL: custody reads unlocked and the first island answers its state", async () => {
    const custody = await sendCustodyFrame({ op: "custody" }, dataDir);
    expect(custody?.["unlocked"], JSON.stringify(custody)).toBe(true);
    const state = await act("island.state");
    expect(state?.["result"], JSON.stringify(state)).toMatchObject({ restarts: 0, leg: expect.any(String) });
  }, 60_000);

  test("R1 RED: the same hand reads its marker from the NEW island, under a changed leg, with custody still open", async () => {
    const put = await lar.cli(["meme", "put", URI, "--recipe", "default", "--file", join(scratch, "marker.mem"), "--json"]);
    expect(put.code, put.stderr).toBe(0);
    const before = await lar.cli(["meme", "get", URI, "--recipe", "default", "--json"]);
    expect(JSON.stringify(before.json)).toContain("the marker the island carries");
    const first = (await act("island.state"))?.["result"] as { leg: string };
    const custodyBefore = await sendCustodyFrame({ op: "custody" }, dataDir);
    const restarted = await act("island.restart", { reason: "e2e" });
    const result = restarted?.["result"] as { restarts: number; leg: string } | undefined;
    expect(result, JSON.stringify(restarted)).toMatchObject({ restarts: 1, leg: expect.any(String) });
    expect(result!.leg, "a boot nonce the first island never held").not.toBe(first.leg);
    const after = await lar.cli(["meme", "get", URI, "--recipe", "default", "--json"]);
    expect(JSON.stringify(after.json), `after: ${after.stdout.slice(0, 600)} ${after.stderr.slice(-400)}`).toContain("the marker the island carries");
    const custody = await sendCustodyFrame({ op: "custody" }, dataDir);
    expect(custody?.["unlocked"]).toBe(true);
    expect(custody?.["attemptsLeft"], "no unlock attempt was spent").toBe(custodyBefore?.["attemptsLeft"]);
  }, 180_000);

  test("R2: a loop of restarts keeps answering, and no leg repeats", async () => {
    const legs = new Set<string>();
    for (let i = 0; i < 4; i += 1) {
      const r = (await act("island.restart", { reason: `loop-${i}` }))?.["result"] as { restarts: number; leg: string };
      expect(r.restarts).toBe(2 + i);
      legs.add(r.leg);
      const got = await lar.cli(["meme", "get", URI, "--recipe", "default", "--json"]);
      expect(JSON.stringify(got.json), `loop ${i}: ${got.stdout.slice(0, 600)} ${got.stderr.slice(-400)}`).toContain("the marker the island carries");
    }
    expect(legs.size).toBe(4);
  }, 300_000);

  test("R3 CONTROL: an unknown act refuses by name, so a silent null reads red", async () => {
    const refused = await act("island.nothing");
    expect(refused, "the door answered").not.toBeNull();
    expect(JSON.stringify(refused)).toMatch(/refus|unknown|error/i);
  }, 60_000);
});
