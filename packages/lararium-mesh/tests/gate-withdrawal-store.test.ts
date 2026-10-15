/**
 * gate-withdrawal-store — a gate's withdrawal memory, resting in rows of the gate's own store.
 *
 * Proven, each beside its control:
 *   · a gate learns a denial, the process restarts, and the gate still denies the withdrawn vessel;
 *   · a standing row that does not fold (an event the face key never signed, another face's event, no list,
 *     a row past its bound) refuses by name, reports its name, and takes no write over it; only a face with no
 *     row reads as nothing learned;
 *   · the store only accretes, across interleaved checks and across a restart;
 *   · one row holds at most 1024 events: a 1025th refuses, and the row keeps what it held;
 *   · a row names its face by a digest and gets read one at a time: the store offers no walk of its rows;
 *   · a rolled-back row forgets, as the law names it.
 */
import { describe, expect, test } from "vitest";
import { canonicalJsonBytes } from "../src/crypto.js";
import { WITHDRAWAL_HISTORY_BOUND, heldWithdrawals } from "../src/face-authority.js";
import { faceProofSubjectRef, genesisFrontier, withdrawalHead, type FaceWithdrawal } from "../src/face-proof-subjects.js";
import { GateMemoryRowTorn, memoryRows, storedWithdrawals } from "../src/gate-withdrawal-store.js";
import { dial, memoryOf, presenter, sibling, world } from "./face-gate-fixture.js";
import { chain, history, pair, withdrawal } from "./face-proof-fixture.js";

const NEXUS = "nexus-a.synthetic";

describe("a gate's memory rests in its own store", () => {
  test("RED: learn, restart, still deny", async () => {
    const rows = memoryRows();
    const before = await world({ withdrawals: storedWithdrawals(rows) });
    const honest = await presenter(before, "restart");
    const gone = await sibling(honest, "restart gone");
    const events = await history(honest.chain, [gone.vessel.key]);
    honest.history = memoryOf(honest.scope, events);
    expect((await dial(before, honest)).gate).toEqual({ outcome: "attached", class: "contracted" });
    expect((await dial(before, gone)).gate).toEqual({ outcome: "answered", state: "withdrawn" });
    // The process ends. A new gate stands over the same rows and nothing else.
    const after = await world({ withdrawals: storedWithdrawals(rows.reopen()) });
    const again = await dial(after, gone);
    expect(again.gate).toEqual({ outcome: "answered", state: "withdrawn" });
    // CONTROL: a gate over empty rows learned nothing, and accepts the withdrawn vessel (the named leak).
    const fresh = await world({ withdrawals: storedWithdrawals(memoryRows()) });
    expect((await dial(fresh, gone)).gate).toEqual({ outcome: "attached", class: "contracted" });
    // The row rests under the face's proof subject, a digest, and holds the signed events alone.
    expect(rows.names()).toEqual([faceProofSubjectRef(honest.scope)]);
    expect(JSON.parse(new TextDecoder().decode(rows.peek(faceProofSubjectRef(honest.scope))!))).toEqual(events);
  });

  test("RED: a gate over a torn row falls silent and writes nothing, where a fresh memory would admit the withdrawn vessel", async () => {
    const rows = memoryRows();
    const before = await world({ withdrawals: storedWithdrawals(rows) });
    const honest = await presenter(before, "torn gate");
    const gone = await sibling(honest, "torn gate gone");
    honest.history = memoryOf(honest.scope, await history(honest.chain, [gone.vessel.key]));
    await dial(before, honest);                                                            // the gate learns the denial
    const name = faceProofSubjectRef(honest.scope);
    // The row's bytes move: its one event gains a field its signature never covered.
    const [event] = JSON.parse(new TextDecoder().decode(rows.peek(name)!)) as Array<Record<string, unknown>>;
    const torn = canonicalJsonBytes([{ ...event, position: 2 }]);
    await rows.write(name, torn);
    const heard: string[] = [];
    const after = await world({ withdrawals: storedWithdrawals(rows.reopen(), { onTorn: (at) => heard.push(at) }) });
    const writes = rows.writes;
    // The withdrawn vessel carries no denial of its own. The gate reads its own row, the row refuses, the gate says nothing.
    expect((await dial(after, gone)).gate.outcome).toBe("silence");
    expect((await dial(after, honest)).gate.outcome).toBe("silence");                      // nor does an honest presenter's history write over it
    expect(heard.every((at) => at === name) && heard.length >= 2).toBe(true);
    expect(rows.writes).toBe(writes);
    expect(Buffer.from(rows.peek(name)!).equals(Buffer.from(torn))).toBe(true);
    // CONTROL: the leak this closes. A gate that reads the row as nothing learned admits the withdrawn vessel.
    const forgetful = await world({ withdrawals: storedWithdrawals(memoryRows()) });
    expect((await dial(forgetful, gone)).gate).toEqual({ outcome: "attached", class: "contracted" });
  });

  test("RED: a standing row that does not fold refuses by name and reports, and no keep writes over it", async () => {
    const c = await chain("forged", NEXUS);
    const other = await chain("forged other", NEXUS);
    const [real] = await history(c, [(await chain("forged gone", NEXUS)).vessel.key]);
    const name = faceProofSubjectRef(c.scope);
    const read = async (row: unknown): Promise<unknown> => {
      const rows = memoryRows();
      await rows.write(name, row instanceof Uint8Array ? row : canonicalJsonBytes(row));
      const torn: string[] = [];
      const store = storedWithdrawals(rows, { onTorn: (at) => torn.push(at) });
      const memory = await Promise.resolve(store.read(c.scope)).catch((e: unknown) => e);
      if (!(memory instanceof GateMemoryRowTorn)) return memory === null ? "nothing" : (memory as { frontier: { position: number } }).frontier.position;
      // THE ROW STANDS UNTOUCHED: a keep of a sound memory reads the row first, refuses the same way and writes nothing.
      const standing = Uint8Array.from(rows.peek(name)!);
      const kept = await Promise.resolve(store.keep(memoryOf(c.scope, [real!]))).then(() => "kept", (e: unknown) => e);
      expect(kept).toBeInstanceOf(GateMemoryRowTorn);
      expect(rows.writes).toBe(1);                                                         // the staging write alone
      expect(Buffer.from(rows.peek(name)!).equals(Buffer.from(standing))).toBe(true);
      expect(memory.row).toBe(name);
      return `refused:${torn.filter((at) => at === name).length}`;
    };
    expect(await read([real])).toBe(1);                                                    // CONTROL: the face key's own event loads
    const forged = await withdrawal(c.scope, 1, genesisFrontier(c.scope).head, other.vessel.key, other.face);   // another key signed it
    expect(await read([forged])).toBe("refused:2");
    expect(await read([real, forged])).toBe("refused:2");                                  // one bad event spoils the row
    const [foreign] = await history(other, [c.vessel.key]);                                // a sound event of another face
    expect(await read([foreign])).toBe("refused:2");
    expect(await read({ events: [real] })).toBe("refused:2");
    expect(await read(new Uint8Array([1, 2, 3]))).toBe("refused:2");
    expect(await read([{ ...real!, position: 2 }])).toBe("refused:2");                      // a decoded field moved: the signature no longer covers it
    expect(await storedWithdrawals(memoryRows()).read(c.scope)).toBeNull();                // no row: nothing, and nothing torn
  });

  test("RED: the store only accretes, across interleaved keeps and across a restart", async () => {
    const c = await chain("accrete-store", NEXUS);
    const events = await history(c, [(await chain("as one", NEXUS)).vessel.key, (await chain("as two", NEXUS)).vessel.key]);
    const rows = memoryRows();
    const store = storedWithdrawals(rows);
    const whole = memoryOf(c.scope, events), older = memoryOf(c.scope, [events[0]]);
    await Promise.all([store.keep(whole), store.keep(older), store.keep(memoryOf(c.scope))]);      // three checks land at once
    expect((await store.read(c.scope))!.frontier.position).toBe(2);
    const restarted = storedWithdrawals(rows.reopen());
    await restarted.keep(older);                                                                    // an older view, after a restart
    expect((await restarted.read(c.scope))!.frontier).toEqual({ position: 2, head: withdrawalHead(events[1]!) });
    await restarted.keep({ ...whole } as never);                                                    // a memory spelled by hand writes nothing
    expect(rows.writes + 0).toBe(1);                                                                // one write held everything: a keep that adds nothing writes nothing
    // Two adapters over one set of rows, each keeping an event the other lacks, at once: neither denial gets lost.
    const d = await chain("accrete-two", NEXUS);
    const both = await history(d, [(await chain("at one", NEXUS)).vessel.key, (await chain("at two", NEXUS)).vessel.key]);
    const shared = memoryRows();
    // A door that answers what the row held when it got asked, a moment later: two unguarded writers would each join against an empty row.
    const slow = { read: async (name: string) => { const bytes = await shared.read(name); await new Promise((r) => setTimeout(r, 5)); return bytes; }, write: (name: string, bytes: Uint8Array) => shared.write(name, bytes) };
    const one = storedWithdrawals(slow), two = storedWithdrawals(slow);
    await Promise.all([one.keep(memoryOf(d.scope, [both[0]])), two.keep(memoryOf(d.scope, [both[1]]))]);
    expect(heldWithdrawals((await storedWithdrawals(shared.reopen()).read(d.scope))!).length).toBe(2);
    // A memory spelled by hand over an EMPTY store, holding an event the face key never signed: nothing rests.
    const other = await chain("accrete-store other", NEXUS);
    const forged = await withdrawal(c.scope, 1, genesisFrontier(c.scope).head, other.vessel.key, other.face);
    const empty = memoryRows();
    await storedWithdrawals(empty).keep({ scope: c.scope, line: [forged], loose: [], denied: [forged.withdrawn], frontier: { position: 1, head: withdrawalHead(forged) }, fork: null } as never);
    expect(empty.writes).toBe(0);
  });

  test("RED: a row rolled back to an older copy forgets, and the next honest keep teaches it again", async () => {
    const c = await chain("rollback", NEXUS);
    const events = await history(c, [(await chain("rb one", NEXUS)).vessel.key, (await chain("rb two", NEXUS)).vessel.key]);
    const rows = memoryRows();
    await storedWithdrawals(rows).keep(memoryOf(c.scope, [events[0]]));
    const older = rows.peek(faceProofSubjectRef(c.scope))!;
    await storedWithdrawals(rows).keep(memoryOf(c.scope, events));
    await rows.write(faceProofSubjectRef(c.scope), older);                                          // a hand restores the older row
    const reopened = rows.reopen();                                                                 // and the process starts again
    const forgot = storedWithdrawals(reopened);
    expect((await forgot.read(c.scope))!.frontier.position).toBe(1);                                // the named leak: no fence here
    await forgot.keep(memoryOf(c.scope, events));
    expect((await storedWithdrawals(reopened.reopen()).read(c.scope))!.frontier.position).toBe(2);
  });

  test("RED: one row holds at most 1024 events: a 1025th refuses, and the row keeps what it held", async () => {
    const c = await chain("bound", NEXUS);
    const keys: string[] = [];
    for (let at = 0; at < WITHDRAWAL_HISTORY_BOUND; at++) keys.push((await pair(`bound ${at}`)).key);
    const full = await history(c, keys);
    const rows = memoryRows();
    const store = storedWithdrawals(rows);
    await store.keep(memoryOf(c.scope, full));
    expect(heldWithdrawals((await store.read(c.scope))!).length).toBe(WITHDRAWAL_HISTORY_BOUND);
    // One event more, signed by the face key itself, standing loose past the line: a sound event the row has no room for.
    const extra: FaceWithdrawal = await withdrawal(c.scope, WITHDRAWAL_HISTORY_BOUND + 5, withdrawalHead(full[10]!), (await chain("bound extra", NEXUS)).vessel.key, c.face);
    const lesser = memoryOf(c.scope, [...full.slice(0, 5), extra]);                                  // a memory that holds it
    await store.keep(lesser);
    const kept = (await storedWithdrawals(rows.reopen()).read(c.scope))!;
    expect(heldWithdrawals(kept).length).toBe(WITHDRAWAL_HISTORY_BOUND);
    expect(heldWithdrawals(kept).some((event) => event.signature === extra.signature)).toBe(false);
    // A row somebody wrote past the bound refuses by name.
    await rows.write(faceProofSubjectRef(c.scope), canonicalJsonBytes([...full, extra]));
    await expect(Promise.resolve(storedWithdrawals(rows.reopen()).read(c.scope))).rejects.toBeInstanceOf(GateMemoryRowTorn);
  }, 240_000);
});

describe("a write the vessel's door refuses", () => {
  test("RED: the store drops its view, and a read in flight across the drop seats nothing — CONTROL: a later read answers the row", async () => {
    const c = await chain("refused write", NEXUS);
    const keys = [(await chain("refused one", NEXUS)).vessel.key, (await chain("refused two", NEXUS)).vessel.key];
    const line = await history(c, keys);                                  // e1, e2
    const name = faceProofSubjectRef(c.scope);
    let held = canonicalJsonBytes([line[0]]);
    let park: Promise<void> | null = null, refuse = false;
    const rows = {
      read: async () => { const bytes = Uint8Array.from(held); if (park) { const wait = park; park = null; await wait; } return bytes; },
      write: async (_name: string, bytes: Uint8Array) => { if (refuse) throw new Error("the door refuses: the row moved"); held = Uint8Array.from(bytes); },
    };
    const store = storedWithdrawals(rows);
    let release!: () => void;
    park = new Promise<void>((resolve) => { release = resolve; });
    const inFlight = store.read(c.scope);                                 // holds the row as it stood at [e1], parked
    // Another writer moves the row to [e1, e2]; this store's keep then meets the door's refusal.
    refuse = true;
    await expect(store.keep(memoryOf(c.scope, line))!).rejects.toThrow(/the door refuses/);
    held = canonicalJsonBytes(line);
    release();
    expect((await inFlight)!.frontier.position).toBe(1);                   // the parked read answers its own caller …
    const after = (await store.read(c.scope))!;                           // … and seats nothing: the next read verifies the row
    expect(after.frontier.position).toBe(2);
    expect(after.frontier.head).toBe(withdrawalHead(line[1]!));
    expect(name.length).toBe(64);
  });
});
