/**
 * critical-gate — THE CONFIRM GATE EVERY CRITICAL PROCEDURE PASSES (browser-vessel-lift#/the-confirm-gate; the operator's note,
 * 2026-11-13: critical procedures "should get gated behind an operator/user confirmation (like the pwd, etc)").
 *
 * The gate's own law, over a stand-in for custody at rest (`tests/vessel-host-reset-gate.test.ts` reads it over a real sealed
 * keystore and the ceremony's own proof worker; `tests/e2e/ceremony.e2e.test.ts` K6 walks it in a founded browser).
 *
 *   G1 RED   A BURN RUNS ONLY ON A PASS. `burnPlace` with no pass, a hand-built pass, another procedure's pass or a spent
 *            pass refuses `gate-unpassed` before the census reads, a tab stands down or a byte burns.
 *            CONTROL: the pass the gate minted for this procedure burns.
 *   G2       CUSTODY HELD ASKS THE PASSPHRASE. With a slot tree standing and reading, the typed phrase alone passes
 *            nothing; a wrong passphrase refuses `no-slot-opens`, mints no pass and burns nothing; the right one passes and
 *            burns. CONTROL: at a bare floor the typed phrase alone passes and burns, and no proof runs.
 *   G3       NO TALLY STANDS: any number of wrong tries leaves the gate as it stood, and the right passphrase then passes.
 *            The gate reads no clock and writes no record.
 *   G4       UNVERIFIABLE CUSTODY (sealed rows and no tree that reads) takes the typed phrase, under its own demand's name,
 *            and asks no proof. CONTROL: one readable tree turns the same store to `held`.
 *   G5       THE DEMAND IS READ AFRESH: custody that changed while the form stood refuses `gate-demand-moved` and passes
 *            nothing; a tree that stopped reading mid-proof reads the same.
 *   G6       NO SECRET LEAVES THE FIELD BUT TO THE PROOF: across a wrong try and a right one, no refusal's words, no pass,
 *            no ask record value, no channel signal, no word said to the person and no console line carries the passphrase.
 *            The field clears before the proof runs. CONTROL: the proof itself received the passphrase's bytes.
 *   G7       THE GATE'S ANSWERS READ THE SAME LOCKED AND UNLOCKED: its env names custody at rest alone, and the same typed
 *            answer draws the same refusal or pass whatever a session holds open.
 *   G8 RED   THE BURN CENSUS: every source file under `src/` that calls a burn primitive (a database delete, a file-system
 *            removal, a cache delete, a service-worker unregister) spends a gate pass. A new destructive door that spends
 *            none reads red here. CONTROL: the census names `reset-core.ts` (a zero would read nothing).
 *   G9       THE PAGE'S TWO DOORS RAISE ONE ASK: the console door's `vessel reset` and the page's own control paint the same
 *            notice, and its words name the gate.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { expect, test, vi } from "vitest";
import type { ResetSignal } from "../src/ceremony-protocol.js";
import {
  custodyRowsOf, gateDemandOf, GateRefused, gateWords, passCriticalGate, readGateStanding, spendGatePass, typedConfirms,
  type GateEnv, type GatePass, type GateProof,
} from "../src/ceremony/critical-gate.js";
import { burnPlace, RESET_PHRASE, RESET_PROCEDURE, resetAskKey, type ResetEnv } from "../src/ceremony/reset-core.js";
import { paintResetAsk, resetAskAnswer } from "../src/ceremony-page.js";

const ASK = "00000000-0000-4000-8000-0000000000aa";
const PASSPHRASE = "the holder's own passphrase";

function storageOf(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return { map, storage: {
    get length() { return map.size; }, key: (i: number) => [...map.keys()][i] ?? null, removeItem: (k: string) => { map.delete(k); },
    getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); },
  } };
}

/** A place to burn, logging every reach, with `ASK` raised on its record. */
function place() {
  const log: string[] = [], said: string[] = [], signals: ResetSignal[] = [];
  const origin = storageOf({ [resetAskKey(ASK)]: "raised", "lares:tab-face": "pg-1" });
  const env: ResetEnv = {
    databases: async () => { log.push("census"); return ["lares:vessel"]; },
    deleteDatabase: async (name) => { log.push(`db ${name}`); },
    opfs: null, caches: null, storages: [origin.storage], record: origin.storage, workers: null,
    signal: (msg) => { signals.push(msg); log.push(msg.t); }, say: (words) => { said.push(words); },
  };
  return { env, log, said, signals, origin };
}

/** Custody at rest, as the gate reads it: the stores' rows, how many trees read, and the one passphrase that opens. */
function custody(state: { trees: number; sealed: number; readable: number; opens?: string }) {
  const proofs: string[] = [];
  const env: GateEnv = {
    census: async () => [{ store: "lares:vessel", trees: state.trees, sealed: state.sealed }],
    readable: async () => state.readable,
    prove: async (_stores, bytes): Promise<GateProof> => {
      const typed = new TextDecoder().decode(bytes);
      proofs.push(typed);
      return state.readable === 0 ? "unverifiable" : typed === state.opens ? "opens" : "no-slot-opens";
    },
  };
  return { env, proofs, state };
}
const BARE = { trees: 0, sealed: 0, readable: 0 };
const HELD = { trees: 1, sealed: 3, readable: 1, opens: PASSPHRASE };
const refusalOf = async (work: Promise<unknown>): Promise<string> => { const e = await work.catch((err: unknown) => err); expect(e).toBeInstanceOf(GateRefused); return (e as GateRefused).refusal; };

test("G1 RED a burn runs only on a pass: no pass, a hand-built one, another procedure's and a spent one refuse gate-unpassed before anything moves; CONTROL: the minted pass burns", async () => {
  const p = place();
  const burn = burnPlace as unknown as (env: ResetEnv, askId: string, pass?: unknown) => Promise<unknown>;
  expect(await refusalOf(burn(p.env, ASK)), "a burn with no pass").toBe("gate-unpassed");
  expect(await refusalOf(burn(p.env, ASK, { procedure: "vessel reset", by: "typed-phrase" })), "a hand-built pass").toBe("gate-unpassed");
  const other = await passCriticalGate({ name: "another door", phrase: "burn it" }, custody(BARE).env, { value: "burn it" }, "typed-phrase");
  expect(await refusalOf(burn(p.env, ASK, other)), "another procedure's pass").toBe("gate-unpassed");
  expect(p.log, "nothing read, signalled or burned").toEqual([]);
  expect([...p.origin.map.keys()], "every key stands").toEqual([resetAskKey(ASK), "lares:tab-face"]);
  // CONTROL: the pass the gate minted for the reset burns, once.
  const pass = await passCriticalGate(RESET_PROCEDURE, custody(BARE).env, { value: RESET_PHRASE }, "typed-phrase");
  await burnPlace(p.env, ASK, pass);
  expect(p.log).toEqual(["census", "reset:stand-down", "db lares:vessel", "reset:burned"]);
  p.origin.map.set(resetAskKey(ASK), "raised");
  expect(await refusalOf(burn(p.env, ASK, pass)), "a spent pass").toBe("gate-unpassed");
  expect(() => spendGatePass(pass, RESET_PROCEDURE)).toThrow(GateRefused);
});

test("G2 custody held asks the passphrase: the typed phrase and a wrong passphrase burn nothing, the right one burns; CONTROL: a bare floor's typed phrase burns with no proof", async () => {
  const held = custody(HELD);
  expect(await readGateStanding(held.env)).toEqual({ standing: "held", stores: ["lares:vessel"] });
  expect(gateDemandOf("held")).toBe("passphrase");
  const p = place();
  // THE TYPED PHRASE ALONE no longer confirms where custody stands: it reads as a passphrase that opens nothing.
  expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, held.env, { value: RESET_PHRASE }, "passphrase"))).toBe("no-slot-opens");
  expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, held.env, { value: "somebody else's guess" }, "passphrase"))).toBe("no-slot-opens");
  expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, held.env, { value: "" }, "passphrase")), "an empty field asks no proof").toBe("no-slot-opens");
  expect(held.proofs).toEqual([RESET_PHRASE, "somebody else's guess"]);
  expect(p.log, "no pass, so nothing burned").toEqual([]);
  // THE RIGHT PASSPHRASE passes, and its pass burns.
  const pass = await passCriticalGate(RESET_PROCEDURE, held.env, { value: PASSPHRASE }, "passphrase");
  expect(pass).toEqual({ procedure: "vessel reset", by: "passphrase" });
  await burnPlace(p.env, ASK, pass);
  expect(p.log).toEqual(["census", "reset:stand-down", "db lares:vessel", "reset:burned"]);

  // CONTROL: a bare floor. The typed phrase alone passes; wrong words refuse; no proof runs.
  const bare = custody(BARE);
  expect(await readGateStanding(bare.env)).toEqual({ standing: "bare", stores: [] });
  expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, bare.env, { value: "reset" }, "typed-phrase"))).toBe("gate-words-differ");
  const barePass = await passCriticalGate(RESET_PROCEDURE, bare.env, { value: "  Reset  This Browser " }, "typed-phrase");
  expect(barePass.by).toBe("typed-phrase");
  expect(bare.proofs, "a bare floor asks no proof").toEqual([]);
  const q = place();
  await burnPlace(q.env, ASK, barePass);
  expect(q.log).toEqual(["census", "reset:stand-down", "db lares:vessel", "reset:burned"]);
  expect(typedConfirms(RESET_PHRASE, RESET_PHRASE)).toBe(true);
  for (const wrong of ["", "reset", "yes", "reset this browser now"]) expect(typedConfirms(wrong, RESET_PHRASE), wrong).toBe(false);
});

test("G3 no tally stands: many wrong tries leave the gate as it stood, the right passphrase then passes, and the gate reads no clock", async () => {
  const held = custody(HELD);
  const now = vi.spyOn(Date, "now");
  const perf = vi.spyOn(performance, "now");
  for (let i = 0; i < 12; i++) expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, held.env, { value: `guess ${String(i)}` }, "passphrase"))).toBe("no-slot-opens");
  expect((await passCriticalGate(RESET_PROCEDURE, held.env, { value: PASSPHRASE }, "passphrase")).by).toBe("passphrase");
  expect(held.proofs.length, "each try reached the proof: none was counted out").toBe(13);
  expect(now.mock.calls.length + perf.mock.calls.length, "the gate read no clock").toBe(0);
  now.mockRestore(); perf.mockRestore();
});

test("G4 unverifiable custody takes the typed phrase under its own name and asks no proof; CONTROL: one readable tree reads held", async () => {
  // Sealed rows, no tree: torn. And a tree row that does not read.
  for (const state of [{ trees: 0, sealed: 2, readable: 0 }, { trees: 1, sealed: 2, readable: 0 }]) {
    const torn = custody(state);
    expect((await readGateStanding(torn.env)).standing).toBe("unverifiable");
    expect(gateDemandOf("unverifiable")).toBe("typed-phrase-unopened");
    expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, torn.env, { value: "anything" }, "typed-phrase-unopened"))).toBe("gate-words-differ");
    expect((await passCriticalGate(RESET_PROCEDURE, torn.env, { value: RESET_PHRASE }, "typed-phrase-unopened")).by).toBe("typed-phrase-unopened");
    expect(torn.proofs).toEqual([]);
  }
  expect((await readGateStanding(custody({ trees: 2, sealed: 2, readable: 1 }).env)).standing, "CONTROL").toBe("held");
  // The words each demand paints name what it asks, and every one names the platform's own way.
  for (const demand of ["typed-phrase", "passphrase", "typed-phrase-unopened"] as const) {
    const words = gateWords(demand, RESET_PROCEDURE);
    expect(words.platform).toContain("clearing this site's data");
    expect(words.ask.includes(RESET_PHRASE), demand).toBe(demand !== "passphrase");
  }
  expect(gateWords("typed-phrase-unopened", RESET_PROCEDURE).ask).toContain("burns unopened");
  expect(custodyRowsOf(["catalog-url", "custody-slots", "sealed/vessel-key", "face-slots/00ff", "face-sealed/00ff/anchor", "ward/root/00ff/tree"])).toEqual({ trees: 2, sealed: 3 });
});

test("G5 the demand reads afresh: custody that changed while the form stood refuses gate-demand-moved and passes nothing", async () => {
  // The form painted a bare floor's typed phrase; a face bound meanwhile.
  const held = custody(HELD);
  expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, held.env, { value: RESET_PHRASE }, "typed-phrase"))).toBe("gate-demand-moved");
  expect(held.proofs, "nothing typed for another demand reaches the proof").toEqual([]);
  // The form painted a passphrase ask; the place burned to bare meanwhile.
  expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, custody(BARE).env, { value: PASSPHRASE }, "passphrase"))).toBe("gate-demand-moved");
  // The trees stopped reading between the standing's read and the proof.
  const racing = custody(HELD);
  const env: GateEnv = { ...racing.env, prove: async () => "unverifiable" };
  expect(await refusalOf(passCriticalGate(RESET_PROCEDURE, env, { value: PASSPHRASE }, "passphrase"))).toBe("gate-demand-moved");
});

test("G6 no secret leaves the field but to the proof: no refusal, pass, record, signal, said word or console line carries it; CONTROL: the proof received it", async () => {
  const held = custody(HELD);
  const p = place();
  const lines: string[] = [];
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) => vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { lines.push(args.map(String).join(" ")); }));
  const wrongGuess = "a wrong but secret guess";
  const field = { value: wrongGuess };
  const refused = await passCriticalGate(RESET_PROCEDURE, held.env, field, "passphrase").catch((e: unknown) => e as GateRefused);
  expect(field.value, "the field cleared").toBe("");
  const right = { value: PASSPHRASE };
  const pass: GatePass = await passCriticalGate(RESET_PROCEDURE, held.env, right, "passphrase");
  expect(right.value).toBe("");
  await burnPlace(p.env, ASK, pass);
  for (const spy of spies) spy.mockRestore();
  const everything = JSON.stringify({
    refusal: [(refused as GateRefused).refusal, (refused as GateRefused).message, String(refused), (refused as GateRefused).stack], pass,
    record: [...p.origin.map.entries()], signals: p.signals, said: p.said, log: p.log, lines,
  });
  for (const secret of [PASSPHRASE, wrongGuess]) expect(everything.includes(secret), `"${secret.slice(0, 6)}…" in ${everything}`).toBe(false);
  // CONTROL: a live instrument. The proof itself took both, and the haystack holds the public words.
  expect(held.proofs).toEqual([wrongGuess, PASSPHRASE]);
  expect(everything).toContain("no-slot-opens");
  expect(everything).toContain("reset:burned");
});

test("G7 the gate's answers read the same locked and unlocked: its env names custody at rest alone", async () => {
  // The env's three doors take stores and bytes; none takes or answers what a session holds open. Two vessels that differ
  // only in what stands unlocked hand the gate the same env, so each answer reads the same.
  const answers = async () => {
    const env = custody(HELD).env;
    return [
      await readGateStanding(env),
      await refusalOf(passCriticalGate(RESET_PROCEDURE, env, { value: "a guess" }, "passphrase")),
      await passCriticalGate(RESET_PROCEDURE, env, { value: PASSPHRASE }, "passphrase"),
    ];
  };
  expect(await answers()).toEqual(await answers());
  expect(Object.keys(custody(HELD).env).sort()).toEqual(["census", "prove", "readable"]);
});

test("G8 RED the burn census: every source file that calls a burn primitive spends a gate pass; CONTROL: the census names reset-core.ts", () => {
  const sources = import.meta.glob("../src/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const strip = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const BURNS = /\.deleteDatabase\s*\(|\.removeEntry\s*\(|\bcaches\.delete\s*\(|\.unregister\s*\(|\bclearFaceCustody\s*\(|\bclearBrowserCustody\s*\(/;
  const burning = Object.entries(sources).filter(([, src]) => BURNS.test(strip(src))).map(([file]) => file);
  expect(burning, "the census reads the reset's burn (a zero would read nothing)").toContain("../src/ceremony/reset-core.ts");
  expect(burning.filter((file) => !/\bspendGatePass\s*\(/.test(strip(sources[file]!))), "burn doors that spend no gate pass").toEqual([]);
});

test("G9 the page's two doors raise one ask, and its words name the gate", () => {
  const doc = document.implementation.createHTMLDocument("page");
  const record = storageOf({}).storage;
  const opened: string[] = [];
  // The console door's row and the page's own control both call `paintResetAsk` (`main.ts`): a second call answers the standing ask.
  const fromConsole = paintResetAsk(doc, () => ASK, (askId) => { opened.push(askId); }, record);
  const fromControl = paintResetAsk(doc, () => "00000000-0000-4000-8000-0000000000bb", (askId) => { opened.push(askId); }, record);
  expect(fromControl).toBe(fromConsole);
  expect(doc.querySelectorAll(".ceremony-ask[data-ask=\"reset\"]").length).toBe(1);
  const notice = doc.querySelector(".ceremony-ask")!.textContent ?? "";
  expect(notice).toContain("passphrase");
  expect(notice).toContain("Nothing burns here");
  const answer = resetAskAnswer(doc, fromConsole);
  expect(answer).toMatchObject({ asked: "reset", askId: ASK });
  expect("next" in answer && answer.next).toContain("passphrase");
  // The answer names no standing: it reads the same whatever this browser holds.
  expect(JSON.stringify(answer)).not.toMatch(/locked|unlocked|sealed|held|bare/);
});
