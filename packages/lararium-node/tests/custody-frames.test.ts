/**
 * The custody door on the verb socket: `unlock`, `lock` and `custody` frames, handled ahead of every verb.
 *
 *   F1  a frame of any other shape passes the door untouched (the verb seat's).       control: a custody frame stays
 *   F2  an unlock that opens recomposes sovereign ONCE; one that opens nothing recomposes nothing.
 *   F3  a lock on an unlocked holder drops the key and recomposes at the floor; on a locked one it does neither.
 *   F4  two unlocks sent together stand ONE sovereign composition.
 *   F5  nothing the door logs or answers carries the credential.
 *   F6  a recomposition that throws answers its own caller by name and leaves the door serving the next frame.
 *   F7  an unlock frame with no usable credential refuses before the holder hears of it.
 *   F8  an unlock whose composition lands at the floor drops the key again: held and standing never disagree.
 *   F9  the door holds a short line: past it a frame refuses at once, and an act whose caller left never runs.
 *
 * The `act` frame: one act of the sealed-act table, run against the key a person already opened.
 *   A1  an act at an unlocked holder runs with NO credential: the holder hears no second unlock.   control: the unlock it rode on
 *   A2  an act at a locked holder refuses `custody-locked` and never runs.                           control: unlocked, it runs
 *   A3  an act the table does not name refuses `unknown-act` by name, and the caller's text reaches no log.
 *   A4  a frame that carries any key beside `op`, `act` and `args` (a credential, say) refuses whole, and nothing runs.
 *   A5  arguments outside an act's own shape refuse `bad-args` before any row opens.
 *   A6  the door logs an act's name and how it ended, and never an argument, an answer or a refusal's words.
 *   A7  an act's fault answers its caller by name (a row that reads torn carries its home, file and reading) and the
 *       door serves the next frame.
 *   A8  an act waits its turn behind an unlock in flight, and a lock that follows waits behind the act.
 *
 * The `backup` frame: one face's bundle body, cut once the frame's own route proves.
 *   B1  a backup at an unlocked holder proves the vessel's route FIRST, then cuts, and answers the body sealed.
 *   B2  a locked vessel refuses `custody-locked`: no proof runs and nothing gets cut.
 *   B3  a route that opens no slot refuses `no-slot-opens` with the attempts left, and nothing gets cut; spent
 *       attempts refuse `attempts-spent`.                                     control: the right route cuts
 *   B4  a frame that misses its shape, or carries any key beside its four, refuses whole before the holder hears.
 *   B5  a cut that refuses answers its own name; a custody fault answers the row it met.
 *   B6  the door logs how the cut ended and never the route, the bundle key or the sealed body.
 *   B7  a door with no cut wired refuses `backup-unavailable`.
 */
import { EventEmitter } from "node:events";
import type { Socket } from "node:net";
import { describe, expect, test } from "vitest";
import { custodyFrameHandler, CUSTODY_LINE } from "../src/custody-frames.js";
import { CustodyRowUnavailable, type CustodyHolder, type HolderProof, type HolderUnlock } from "../src/custody-holder.js";
import { BackupRefused, type FaceBundleCut } from "../src/face-bundle-cut.js";
import { runSealedAct } from "../src/sealed-acts.js";

const RIGHT = "frames-test-passphrase-right";

function fakeSock(): { sock: Socket; answer: Promise<Record<string, unknown>> } {
  let settle!: (a: Record<string, unknown>) => void;
  const answer = new Promise<Record<string, unknown>>((r) => { settle = r; });
  const sock = Object.assign(new EventEmitter(), { end: (line: string) => settle(JSON.parse(line) as Record<string, unknown>) }) as unknown as Socket;
  return { sock, answer };
}

function harness(opts: {
  recomposeThrows?: boolean; recomposeRefuses?: boolean; slowMs?: number; runAct?: (act: string, args: unknown) => Promise<Record<string, unknown>>;
  backup?: (face: number, bundleKey: Uint8Array) => Promise<FaceBundleCut>;
} = {}) {
  let unlocked = false;
  let spent = 0;
  const heard: unknown[] = [];
  const proved: unknown[] = [];
  const holder = {
    unlock: async (creds): Promise<HolderUnlock> => {
      heard.push(creds);
      if (unlocked) return { reading: "already-unlocked" };
      const ok = creds.some((c) => c.kind === "passphrase" && c.passphrase === RIGHT);
      if (!ok) { spent += 1; return { reading: "no-slot-opens", attemptsLeft: 3 - spent }; }
      unlocked = true;
      return { reading: "opens", slot: "slot-1" };
    },
    proves: async (creds): Promise<HolderProof> => {
      proved.push(creds);
      if (!unlocked) return { reading: "locked" };
      if (spent >= 3) return { reading: "attempts-spent" };
      if (creds.some((c) => c.kind === "passphrase" && c.passphrase === RIGHT)) return { reading: "proves" };
      spent += 1;
      return { reading: "no-slot-opens", attemptsLeft: 3 - spent };
    },
    lock: async () => { unlocked = false; },
    isUnlocked: () => unlocked,
    attemptsLeft: () => 3 - spent,
    openedSlot: () => (unlocked ? "slot-1" : null),
    readRow: async () => ({ reading: "locked" }),
    writeRow: async () => {},
    openColdRow: async () => { throw new Error("unused"); },
    derive: () => new Uint8Array(),
  } as unknown as CustodyHolder;
  const recomposed: boolean[] = [];
  const logs: string[] = [];
  const handle = custodyFrameHandler({
    holder, testScratch: false,
    standing: () => "herm",
    recompose: async (sovereign) => {
      recomposed.push(sovereign);
      await new Promise((r) => setTimeout(r, opts.slowMs ?? 15));
      if (opts.recomposeThrows) throw new Error("the composition fell over");
      if (opts.recomposeRefuses && sovereign) return { standing: "herm", refused: "a face it cannot prove" };
      return { standing: sovereign ? "hearth" : "herm" };
    },
    onLog: (line) => logs.push(line),
    ...(opts.runAct ? { runAct: opts.runAct } : {}),
    ...(opts.backup ? { backup: opts.backup } : {}),
  });
  const send = (frame: unknown, gone = false): { consumed: boolean; answer: Promise<Record<string, unknown>> } => {
    const { sock, answer } = fakeSock();
    if (gone) (sock as unknown as { destroyed: boolean }).destroyed = true;
    return { consumed: handle(frame, sock), answer };
  };
  return { send, recomposed, logs, heard, proved, holder };
}

const unlockFrame = (passphrase: string) => ({ op: "unlock", credentials: [{ kind: "passphrase", passphrase }] });

describe("the custody door", () => {
  test("F1 — a verb, a receipt query and a cancel pass the door; a custody frame stays", () => {
    const h = harness();
    expect(h.send({ verb: "meme-get", requestedBy: "did:key:x" }).consumed).toBe(false);
    expect(h.send({ op: "receipt", requestId: "r" }).consumed).toBe(false);
    expect(h.send({ op: "cancel", requestId: "r" }).consumed).toBe(false);
    expect(h.send(null).consumed).toBe(false);
    expect(h.send({ op: "custody" }).consumed).toBe(true);
  });

  test("F2 — an opening unlock recomposes sovereign once; a miss recomposes nothing", async () => {
    const h = harness();
    const miss = await h.send(unlockFrame("wrong")).answer;
    expect(miss).toMatchObject({ op: "unlock", reading: "no-slot-opens", attemptsLeft: 2, standing: "herm" });
    expect(h.recomposed).toEqual([]);
    const hit = await h.send(unlockFrame(RIGHT)).answer;
    expect(hit).toMatchObject({ op: "unlock", reading: "opens", slot: "slot-1", standing: "hearth", held: true });
    expect(h.recomposed).toEqual([true]);
  });

  test("F3 — lock drops the key and recomposes at the floor; a second lock does neither", async () => {
    const h = harness();
    await h.send(unlockFrame(RIGHT)).answer;
    expect(await h.send({ op: "lock" }).answer).toMatchObject({ op: "lock", locked: true, was: "unlocked", standing: "herm" });
    expect(h.holder.isUnlocked()).toBe(false);
    expect(h.recomposed).toEqual([true, false]);
    expect(await h.send({ op: "lock" }).answer).toMatchObject({ locked: true, was: "locked" });
    expect(h.recomposed).toEqual([true, false]);
    expect(await h.send({ op: "custody" }).answer).toMatchObject({ op: "custody", unlocked: false, slot: null, attemptsLeft: 3, standing: "herm" });
  });

  test("F4 — two unlocks sent together stand one sovereign composition", async () => {
    const h = harness();
    const [a, b] = [h.send(unlockFrame(RIGHT)), h.send(unlockFrame(RIGHT))];
    const answers = [await a.answer, await b.answer].map((x) => x["reading"]);
    expect(answers.sort()).toEqual(["already-unlocked", "opens"]);
    expect(h.recomposed).toEqual([true]);
  });

  test("F5 — no log line and no answer carries the credential", async () => {
    const h = harness();
    const answers = [await h.send(unlockFrame("a-wrong-secret-guess")).answer, await h.send(unlockFrame(RIGHT)).answer];
    const spoken = JSON.stringify(answers) + h.logs.join("\n");
    expect(spoken).not.toContain(RIGHT);
    expect(spoken).not.toContain("a-wrong-secret-guess");
    expect(h.logs.join("\n")).toContain("slot slot-1");          // CONTROL: the door did log, and logged the slot
  });

  test("F6 — a recomposition that throws names itself to its caller; the door serves the next frame", async () => {
    const h = harness({ recomposeThrows: true });
    expect(await h.send(unlockFrame(RIGHT)).answer).toMatchObject({ status: "error", refusal: { reason: "custody-act-failed" }, errorMessage: "the composition fell over" });
    expect(await h.send({ op: "custody" }).answer).toMatchObject({ op: "custody", unlocked: true });
  });

  test("F7 — an unlock with no usable credential refuses before the holder hears of it", async () => {
    const h = harness();
    for (const bad of [{ op: "unlock" }, { op: "unlock", credentials: [] }, { op: "unlock", credentials: [{ kind: "passphrase" }] }, { op: "unlock", credentials: "x" }]) {
      expect(await h.send(bad).answer).toMatchObject({ status: "error", refusal: { reason: "bad-custody-frame" } });
    }
    expect(h.heard).toEqual([]);
    expect(h.recomposed).toEqual([]);
  });

  test("F8 — an unlock whose composition lands at the floor drops the key again", async () => {
    const h = harness({ recomposeRefuses: true });
    const a = await h.send(unlockFrame(RIGHT)).answer;
    expect(a).toMatchObject({ op: "unlock", reading: "opens", standing: "herm", refused: "a face it cannot prove", held: false });
    expect(h.holder.isUnlocked(), "no key rests over a floor").toBe(false);
    // CONTROL: a composition that stands keeps the key.
    const ok = harness();
    expect(await ok.send(unlockFrame(RIGHT)).answer).toMatchObject({ held: true, standing: "hearth" });
    expect(ok.holder.isUnlocked()).toBe(true);
  });

  test("F9 — past the door's line a frame refuses at once; an act whose caller left never runs", async () => {
    const h = harness({ slowMs: 40 });
    const first = h.send(unlockFrame(RIGHT));                       // holds the chain while it recomposes
    await new Promise((r) => setTimeout(r, 5));                     // its turn began: it no longer waits in line
    const gone = h.send({ op: "lock" }, true);                      // its caller left before its turn
    const waiting = Array.from({ length: CUSTODY_LINE - 1 }, () => h.send({ op: "custody" }));
    const over = await h.send({ op: "custody" }).answer;            // one past the line
    expect(over).toMatchObject({ status: "error", refusal: { reason: "custody-door-busy" } });
    await first.answer;
    for (const w of waiting) expect(await w.answer).toMatchObject({ op: "custody", unlocked: true });
    void gone;
    expect(h.recomposed, "the departed caller's lock never ran").toEqual([true]);
    expect(h.holder.isUnlocked()).toBe(true);
  });
});

describe("the custody door's act frame", () => {
  /** A door whose acts get counted and answered by a stand-in: the frame's own law, apart from any row. */
  function acting(run?: (act: string, args: unknown) => Promise<Record<string, unknown>>) {
    const ran: Array<{ act: string; args: unknown }> = [];
    const h = harness({ runAct: async (act, args) => { ran.push({ act, args }); return run ? run(act, args) : { held: "ANSWER-CANARY" }; } });
    return { ...h, ran };
  }

  test("A1 — an act at an unlocked holder runs with no credential: the holder hears no second unlock", async () => {
    const h = acting();
    await h.send(unlockFrame(RIGHT)).answer;
    expect(h.heard.length).toBe(1);                                    // CONTROL: the one unlock a person performed
    expect(await h.send({ op: "act", act: "persona.roots", args: {} }).answer).toEqual({ op: "act", act: "persona.roots", result: { held: "ANSWER-CANARY" } });
    expect(await h.send({ op: "act", act: "persona.roots" }).answer).toMatchObject({ op: "act", result: { held: "ANSWER-CANARY" } });
    expect(h.heard.length, "an act never asks the holder to open").toBe(1);
    expect(h.recomposed).toEqual([true]);                              // and never recomposes
    expect(h.ran.length).toBe(2);
  });

  test("A2 — an act at a locked holder refuses custody-locked and never runs", async () => {
    const h = acting();
    const a = await h.send({ op: "act", act: "persona.roots", args: {} }).answer;
    expect(a).toMatchObject({ op: "act", status: "error", refusal: { reason: "custody-locked" } });
    expect(String(a["errorMessage"])).toContain("lares vault unlock");
    expect(h.ran).toEqual([]);
    expect(h.heard).toEqual([]);                                       // a refused act opens nothing
    await h.send(unlockFrame(RIGHT)).answer;
    expect(await h.send({ op: "act", act: "persona.roots", args: {} }).answer).toMatchObject({ op: "act", act: "persona.roots" });   // CONTROL
    await h.send({ op: "lock" }).answer;
    expect(await h.send({ op: "act", act: "persona.roots", args: {} }).answer).toMatchObject({ refusal: { reason: "custody-locked" } });
    expect(h.ran.length).toBe(1);
  });

  test("A3 — an act the table does not name refuses by name, and the caller's text reaches no log", async () => {
    const h = harness({ runAct: (act, args) => runSealedAct(act, args, { kelHead: null, personaSelves: null, walk: null }) });
    await h.send(unlockFrame(RIGHT)).answer;
    const a = await h.send({ op: "act", act: "vault.export-everything-CALLER-TEXT", args: {} }).answer;
    expect(a).toMatchObject({ op: "act", status: "error", refusal: { reason: "unknown-act" } });
    expect(String(a["errorMessage"])).toContain("vault.export-everything-CALLER-TEXT");            // the caller reads the name it sent
    expect(h.logs.join("\n")).not.toContain("CALLER-TEXT");
    expect(h.logs.at(-1)).toBe("act (an act the table does not name): refused (unknown-act)");
  });

  test("A4 — a frame that carries a key beside op, act and args refuses whole, and nothing runs", async () => {
    const h = acting();
    await h.send(unlockFrame(RIGHT)).answer;
    for (const stray of [
      { op: "act", act: "persona.roots", args: {}, credentials: [{ kind: "passphrase", passphrase: "a-credential-on-an-act" }] },
      { op: "act", act: "persona.roots", args: {}, requestedBy: "did:key:x" },
      { op: "act", args: {} },
      { op: "act", act: 7, args: {} },
    ]) {
      expect(await h.send(stray).answer).toMatchObject({ op: "act", status: "error", refusal: { reason: "bad-custody-frame" } });
    }
    expect(h.ran).toEqual([]);
    expect(h.heard.length).toBe(1);                                    // the stray credential reached no holder
    expect(h.logs.join("\n")).not.toContain("a-credential-on-an-act");
  });

  test("A5 — arguments outside an act's own shape refuse bad-args before any row opens", async () => {
    const h = harness({ runAct: (act, args) => runSealedAct(act, args, { kelHead: null, personaSelves: null, walk: null }) });
    await h.send(unlockFrame(RIGHT)).answer;
    for (const args of [{ handleIndex: 0, petname: "x", passphrase: "an-argument-no-row-named" }, { handleIndex: -1, petname: "x" }, { handleIndex: 0 }, "not-a-record", [1]]) {
      expect(await h.send({ op: "act", act: "petname.set", args }).answer).toMatchObject({ op: "act", status: "error", refusal: { reason: "bad-args" } });
    }
    // The harness holder answers every row `locked`: a refusal that reached a row would read otherwise.
    expect(await h.send({ op: "act", act: "petname.set", args: { handleIndex: 0, petname: "x" } }).answer).not.toMatchObject({ refusal: { reason: "bad-args" } });   // CONTROL: a sound shape passes the table
  });

  test("A6 — the door logs an act's name and how it ended, never an argument, an answer or a refusal's words", async () => {
    const h = acting(async (act) => {
      if (act === "petname.set") throw new Error("REFUSAL-WORDS that quote a pet-name");
      return { held: "ANSWER-CANARY" };
    });
    await h.send(unlockFrame(RIGHT)).answer;
    await h.send({ op: "act", act: "petname.entries", args: { note: "ARG-CANARY" } }).answer;
    const refused = await h.send({ op: "act", act: "petname.set", args: { handleIndex: 0, petname: "ARG-CANARY-2" } }).answer;
    expect(refused).toMatchObject({ status: "error", errorMessage: "REFUSAL-WORDS that quote a pet-name", refusal: { reason: "act-failed" } });   // the caller hears the words
    const logged = h.logs.join("\n");
    for (const secret of ["ANSWER-CANARY", "ARG-CANARY", "REFUSAL-WORDS"]) expect(logged).not.toContain(secret);
    expect(h.logs.slice(-2)).toEqual(["act petname.entries: done", "act petname.set: refused (act-failed)"]);   // CONTROL: the door did log both
  });

  test("A7 — an act's fault answers by name with the row it met, and the door serves the next frame", async () => {
    const h = acting(async () => { throw new CustodyRowUnavailable("identity", ".persona-roster.json", "torn"); });
    await h.send(unlockFrame(RIGHT)).answer;
    expect(await h.send({ op: "act", act: "persona.roots", args: {} }).answer).toMatchObject({
      op: "act", status: "error", refusal: { reason: "row-unavailable", home: "identity", file: ".persona-roster.json", reading: "torn" },
    });
    expect(await h.send({ op: "custody" }).answer).toMatchObject({ op: "custody", unlocked: true });
  });

  test("A8 — an act waits behind an unlock in flight, and a lock that follows waits behind the act", async () => {
    const order: string[] = [];
    const h = harness({ slowMs: 30, runAct: async () => { order.push("act-start"); await new Promise((r) => setTimeout(r, 20)); order.push("act-end"); return {}; } });
    const unlocking = h.send(unlockFrame(RIGHT));
    const act = h.send({ op: "act", act: "persona.roots", args: {} });
    const locking = h.send({ op: "lock" });
    expect(await act.answer).toMatchObject({ op: "act", act: "persona.roots" });   // sent while locked; ran once the unlock stood
    await unlocking.answer;
    expect(await locking.answer).toMatchObject({ op: "lock", was: "unlocked" });
    expect(order).toEqual(["act-start", "act-end"]);
    expect(h.recomposed).toEqual([true, false]);                                      // the lock recomposed after the act ended
  });
});

describe("the custody door's backup frame", () => {
  const KEY = "5a".repeat(32);
  const BODY = Uint8Array.from({ length: 48 }, (_, i) => 0xc0 ^ i);
  const cut: FaceBundleCut = {
    sealedBody: BODY, holds: [{ bagId: "lar:///ha.ka.ba/@test/bags/garden-notes", founding: "11".repeat(32), keyVersion: "22".repeat(32) }],
    face: { handleIndex: 2, verifyingKey: "ab".repeat(32) },
    carries: { keyEvents: 1, faceProofKeys: 0, handleBookRecords: 0, petname: false, handle: false, guardians: 0 },
  };
  const backupFrame = (passphrase: string, over: Record<string, unknown> = {}) => ({ op: "backup", credentials: [{ kind: "passphrase", passphrase }], face: 2, key: KEY, ...over });
  function cutting(run?: (face: number, bundleKey: Uint8Array) => Promise<FaceBundleCut>) {
    const cuts: Array<{ face: number; key: string }> = [];
    const h = harness({ backup: async (face, bundleKey) => { cuts.push({ face, key: Buffer.from(bundleKey).toString("hex") }); return run ? run(face, bundleKey) : cut; } });
    return { ...h, cuts };
  }

  test("B1 — a backup proves the vessel's route first, then cuts, and answers the body sealed", async () => {
    const h = cutting();
    await h.send(unlockFrame(RIGHT)).answer;
    const a = await h.send(backupFrame(RIGHT)).answer;
    expect(a).toEqual({ op: "backup", sealedBody: Buffer.from(BODY).toString("base64"), holds: cut.holds, face: cut.face, carries: cut.carries });
    expect(h.proved.length).toBe(1);
    expect(h.cuts).toEqual([{ face: 2, key: KEY }]);
    expect(h.heard.length, "a backup never asks the holder to open").toBe(1);
    expect(h.recomposed).toEqual([true]);
  });

  test("B1 — the bundle key handed to the cut reads zero once the cut settles", async () => {
    let held!: Uint8Array;
    const h = cutting(async (_face, bundleKey) => { held = bundleKey; expect(bundleKey.some((b) => b !== 0)).toBe(true); return cut; });
    await h.send(unlockFrame(RIGHT)).answer;
    await h.send(backupFrame(RIGHT)).answer;
    expect(held.every((b) => b === 0)).toBe(true);
  });

  test("B2 — a locked vessel refuses custody-locked: no proof runs and nothing gets cut", async () => {
    const h = cutting();
    expect(await h.send(backupFrame(RIGHT)).answer).toMatchObject({ op: "backup", status: "error", refusal: { reason: "custody-locked" } });
    expect(h.proved).toEqual([]);
    expect(h.cuts).toEqual([]);
    await h.send(unlockFrame(RIGHT)).answer;                              // CONTROL: unlocked, the same frame cuts
    expect(await h.send(backupFrame(RIGHT)).answer).toMatchObject({ op: "backup", face: cut.face });
  });

  test("B3 — a route that opens no slot refuses with the attempts left and cuts nothing; spent attempts refuse by name", async () => {
    const h = cutting();
    await h.send(unlockFrame(RIGHT)).answer;
    expect(await h.send(backupFrame("frames-wrong-1")).answer).toMatchObject({ op: "backup", status: "error", refusal: { reason: "no-slot-opens", attemptsLeft: 2 } });
    await h.send(backupFrame("frames-wrong-2")).answer;
    await h.send(backupFrame("frames-wrong-3")).answer;
    expect(await h.send(backupFrame(RIGHT)).answer).toMatchObject({ op: "backup", status: "error", refusal: { reason: "attempts-spent" } });
    expect(h.cuts).toEqual([]);
    const control = cutting();                                            // CONTROL: the right route, first, cuts
    await control.send(unlockFrame(RIGHT)).answer;
    expect(await control.send(backupFrame(RIGHT)).answer).toMatchObject({ op: "backup", face: cut.face });
  });

  test("B4 — a frame that misses its shape or carries a stray key refuses whole before the holder hears", async () => {
    const h = cutting();
    await h.send(unlockFrame(RIGHT)).answer;
    const bent: Record<string, unknown>[] = [
      backupFrame(RIGHT, { out: "/tmp/elsewhere" }), backupFrame(RIGHT, { act: "persona.roots" }),
      backupFrame(RIGHT, { key: "5A".repeat(32) }), backupFrame(RIGHT, { key: KEY.slice(2) }), backupFrame(RIGHT, { key: 7 }),
      backupFrame(RIGHT, { face: -1 }), backupFrame(RIGHT, { face: "2" }), backupFrame(RIGHT, { face: 1.5 }),
      backupFrame(RIGHT, { credentials: [] }), backupFrame(RIGHT, { credentials: [{ kind: "passphrase" }] }),
    ];
    for (const frame of bent) expect(await h.send(frame).answer).toMatchObject({ op: "backup", status: "error", refusal: { reason: "bad-custody-frame" } });
    expect(h.proved).toEqual([]);
    expect(h.cuts).toEqual([]);
  });

  test("B5 — a cut that refuses answers its own name; a custody fault answers the row it met; the door serves on", async () => {
    let fault: Error = new BackupRefused("face-not-worn", "this vessel wears h0");
    const h = cutting(async () => { throw fault; });
    await h.send(unlockFrame(RIGHT)).answer;
    expect(await h.send(backupFrame(RIGHT)).answer).toMatchObject({ op: "backup", status: "error", errorMessage: "this vessel wears h0", refusal: { reason: "face-not-worn" } });
    fault = new CustodyRowUnavailable("identity", ".persona-roster.json", "torn");
    expect(await h.send(backupFrame(RIGHT)).answer).toMatchObject({ refusal: { reason: "row-unavailable", home: "identity", file: ".persona-roster.json", reading: "torn" } });
    fault = new Error("the port closed");
    expect(await h.send(backupFrame(RIGHT)).answer).toMatchObject({ refusal: { reason: "backup-failed" } });
    expect(await h.send({ op: "custody" }).answer).toMatchObject({ op: "custody", unlocked: true });
  });

  test("B6 — the door logs how a cut ended and never the route, the bundle key or the sealed body", async () => {
    const h = cutting();
    await h.send(unlockFrame(RIGHT)).answer;
    const done = await h.send(backupFrame(RIGHT)).answer;
    const missed = await h.send(backupFrame("frames-wrong-canary")).answer;
    const logged = h.logs.join("\n");
    expect(logged).toContain("backup: done");
    expect(logged).toContain("backup: refused (no-slot-opens)");
    for (const secret of [RIGHT, "frames-wrong-canary", KEY, Buffer.from(BODY).toString("base64"), "garden-notes", "ab".repeat(32)]) expect(logged).not.toContain(secret);
    for (const secret of [RIGHT, "frames-wrong-canary", KEY]) expect(JSON.stringify([done, missed])).not.toContain(secret);
  });

  test("B7 — a door with no cut wired refuses backup-unavailable", async () => {
    const h = harness();
    await h.send(unlockFrame(RIGHT)).answer;
    expect(await h.send(backupFrame(RIGHT)).answer).toMatchObject({ op: "backup", status: "error", refusal: { reason: "backup-unavailable" } });
    expect(h.proved).toEqual([]);
  });
});
