/**
 * sense-lifecycle-hand — the daemon's sense lifecycle reactors read the asker's hand, never an argument (hitl-reads-a-hand).
 *
 * `promote`, `retire`, `un-retire` and `purge` run on a person's hand at a real terminal alone: the vessel's door books the
 * asker (`cli` for a terminal, `seat` where a harness stands on the peer's branch), and only `cli` reaches the executor. A seat
 * that sends `approve: true` refuses `sense-needs-hand` before anything routes; a tab, a watcher and an ask no door read (a
 * synced summons) refuse the same. CONTROL: a terminal's ask lands, the executor reads the hand from the reactor and never from
 * the args, and the reads stay open to a seat.
 */
import { describe, expect, test } from "vitest";
import { captureVerbCap, type DaemonVerbProvider } from "../src/verb-caps.js";
import { VerbTable, type VerbContext } from "../src/verb-dispatcher.js";

type Call = { readonly verb: string; readonly input: Record<string, unknown> };

function stand(): { readonly table: VerbTable; readonly calls: Call[] } {
  const calls: Call[] = [];
  const answer = (verb: string) => async (input: Record<string, unknown> = {}) => { calls.push({ verb, input }); return { ok: true }; };
  const provider = {
    senseRoster: answer("roster"), senseInspect: answer("inspect"), senseBuild: answer("build"), senseReconcile: answer("reconcile"),
    sensePromote: answer("promote"), senseRetire: answer("retire"), senseUnRetire: answer("un-retire"), sensePurge: answer("purge"),
  } as unknown as DaemonVerbProvider;
  const table = new VerbTable();
  captureVerbCap().build(<T>() => provider as unknown as T)(table);
  return { table, calls };
}

const ctx = (asker?: VerbContext["asker"]): VerbContext => ({ ...(asker ? { asker } : {}) } as unknown as VerbContext);

const HAND_ONLY: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ["promote", { name: "alpha", approve: true }],
  ["retire", { name: "alpha", grounds: "superseded", approve: true }],
  ["un-retire", { name: "alpha" }],
  ["purge", { name: "alpha", approve: true }],
];

describe("the sense lifecycle reactors read the hand the door booked", () => {
  for (const [verb, args] of HAND_ONLY) {
    test(`RED: ${verb} refuses a seat (approve: true counts for nothing), a tab and an unread ask; CONTROL: a terminal lands it`, async () => {
      const { table, calls } = stand();
      const run = table.get(verb)!;
      for (const asker of ["seat", "tab", "watcher", undefined] as const) {
        await expect(run(args, ctx(asker as VerbContext["asker"])), `${verb} · ${asker ?? "unread"}`).rejects.toThrow(/sense-needs-hand/);
      }
      expect(calls, `${verb}: nothing reached the executor`).toEqual([]);
      await expect(run(args, ctx("cli"))).resolves.toMatchObject({ ok: true });
      expect(calls).toHaveLength(1);
      expect(calls[0]!.input["hand"], `${verb}: the executor reads the reactor's hand`).toBe("hand");
      expect(calls[0]!.input, `${verb}: no caller-filled approval rides to the executor`).not.toHaveProperty("approve");
    });
  }

  test("RED: the refusal names the hand act to run on a real terminal", async () => {
    const { table } = stand();
    await expect(table.get("purge")!({ name: "alpha", approve: true }, ctx("seat"))).rejects.toThrow(/lares sense purge/);
  });

  test("CONTROL: the reads and the reversible re-settle stay open to a seat", async () => {
    const { table, calls } = stand();
    await table.get("roster")!({}, ctx("seat"));
    await table.get("inspect")!({ name: "alpha" }, ctx("seat"));
    await table.get("reconcile")!({ name: "alpha" }, ctx("seat"));
    expect(calls.map((c) => c.verb)).toEqual(["roster", "inspect", "reconcile"]);
  });
});
