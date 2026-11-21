/**
 * rite-command — `lares rite kukulu | begin | land | receipts` (road L45d).
 *
 * `kukulu` (kūkulu: the house raised again around its hearth) runs on the host, the one human restand verb: it fast-forwards
 * the checkout, has the shim make the image and read where the house stands, spends each face's kukulu lei where one stands,
 * then the shim's restand, and the vessel that stands after lands the host half. Every port here answers from a FAKE: no shim
 * runs, no container; git runs only in scratch repos.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { repoRoot } from "@lararium/mesh/node";
import { LARES_MEMETIC_WIKITEXT_PLUGIN_URI, foundingRecordDigests, type GenesisDigests, type GenesisRecordLike } from "@lararium/mesh";
import { genesisSeedCid } from "@lararium/node";
import { hostSeedOfferPort } from "../src/seed-offered.js";
import { parseArgs } from "../src/parse-args.js";
import { RiteUsage, hostRefill, hostRowLine, ritePlan, rollbackOf, standingOf, syncCheckout } from "../src/commands/rite.js";
import { kukuluSeedLine, priorImageRef, riteKukulu, syncPlan, type RitePorts, type RiteVerbAnswer, type StandReading } from "../src/rite-kukulu.js";
import { decideRoute } from "../src/host-bridge.js";
import { COMMAND_NAMES } from "../src/bin/lares.js";

const HEAD = "a".repeat(40), TESSERA = "c".repeat(64), IMAGE = "sha256:" + "ab".repeat(32);
const plan = (...line: string[]) => ritePlan(parseArgs(["rite", ...line]));
/** The shim's reading of a house with no pūlama, the vessel standing on an older image, the image built at HEAD. */
const READING: StandReading = { revision: HEAD, image: IMAGE, how: "built", vessel: "standing", current: false, pulama: "off", lit: null, admitted: null, offer: false };
/** A pūlama lit on a closure that stands, the image neither admitted nor offered. */
const LIT: Partial<StandReading> = { pulama: "closure-level", lit: true, admitted: false };

/** Ports that record every call in order and answer from a script. */
function fakes(over: { begin?: RiteVerbAnswer; land?: RiteVerbAnswer; reading?: Partial<StandReading>; stage?: number; raise?: number; tty?: boolean } = {}) {
  const calls: string[] = [], said: string[] = [];
  const ports: RitePorts = {
    checkout: async () => { calls.push("checkout"); return { head: HEAD, branch: "main" }; },
    stage: async (target) => { calls.push(`stage ${JSON.stringify(target)}`); return { code: over.stage ?? 0, reading: { ...READING, ...over.reading } }; },
    raise: async (rev) => { calls.push(`raise ${rev}`); return over.raise ?? 0; },
    ...(over.tty === undefined ? {} : { tty: () => over.tty as boolean }),
    row: async (verb, args) => {
      calls.push(`${verb} ${JSON.stringify(args)}`);
      if (verb === "rite-begin") return over.begin ?? { ok: true, output: { rite: "kukulu", faces: [{ face: "h0", ordinal: 0, tessera: TESSERA, lei: "d".repeat(64), n: 1, begun: "e".repeat(64) }], waits: [] } };
      if (verb === "rite-offer") return { ok: true, output: { lei: 1, faces: ["h0"], waits: [] } };
      return over.land ?? { ok: true, output: { tessera: TESSERA, rite: "kukulu", begun: "e".repeat(64), landed: "f".repeat(64), par: true } };
    },
    say: (line) => { said.push(line); },
  };
  return { ports, calls, said };
}
const BEGIN = `rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD })}`;
const OFFER = `rite-offer ${JSON.stringify({ branch: "main", head: HEAD, image: IMAGE })}`;
const LAND = `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD, face: 0 })}`;
const STAGE = `stage ${JSON.stringify({ at: HEAD })}`;
const ABSENT: RiteVerbAnswer = { ok: false, code: "swarm-lei-absent", message: "swarm-lei-absent: the kukulu lei for \"main\" does not stand (absent)" };

describe("kukulu-walks-the-whole-restand", () => {
  it("RED: the image comes first, then the rite begins in the standing vessel, the offer rests over the image the host made, the shim's restand raises the house, and the landing reads par", async () => {
    const f = fakes();
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, BEGIN, OFFER, `raise ${HEAD}`, LAND]);
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, tesserae: [{ face: "h0", tessera: TESSERA }], begun: true, landed: true, par: true } });
    expect(f.said.join("\n")).toMatch(/the offer rests for the next vessel \(1 lei, a vouch for each of h0 over sha256:abab/);
  });

  it("RED: an image step that fails spends no lei and moves nothing: no begin, no raise", async () => {
    const f = fakes({ stage: 2 });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE]);
    expect(out).toMatchObject({ code: 1, data: { begun: false, stopped: "image" } });
    expect(f.said.join("\n")).toMatch(/no lei spent a return/);
  });

  it("RED: a `--face` rides the begin and the offer as the face their session acts as; CONTROL: naming none, the rows name none", async () => {
    const f = fakes();
    await riteKukulu(f.ports, { face: 0 });
    expect(f.calls[2]).toBe(`rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD, face: 0 })}`);
    expect(f.calls[3]).toBe(`rite-offer ${JSON.stringify({ branch: "main", head: HEAD, image: IMAGE, face: 0 })}`);
    const bare = fakes();
    await riteKukulu(bare.ports, {});
    expect(bare.calls[2]).toBe(BEGIN);
  });

  it("RED: a restand that fails ends the rite, names the landing the begun half waits on, and that the rite picks up from where the house stands; CONTROL: a `--branch` names the line", async () => {
    const f = fakes({ raise: 9 });
    const out = await riteKukulu(f.ports, { branch: "feature/x" });
    expect(f.calls[2]).toBe(`rite-begin ${JSON.stringify({ rite: "kukulu", branch: "feature/x", head: HEAD })}`);
    expect(out).toMatchObject({ code: 1, data: { begun: true, landed: false, stopped: "raise" } });
    expect(f.said.join("\n")).toMatch(new RegExp(`picks up from where the house stands; the lei's return stays spent[\\s\\S]*lares rite land --tessera ${TESSERA} --head ${HEAD} --face 0`));
  });

  it("RED: no kukulu lei on the line runs the restand with no rite (no offer, no landing); CONTROL: any other begin refusal raises nothing", async () => {
    const f = fakes({ begin: ABSENT });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, BEGIN, `raise ${HEAD}`]);
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, begun: false, raised: true } });
    expect(f.said.join("\n")).toMatch(/no kukulu lei stands on main, so the restand goes on with no rite/);
    const g = fakes({ begin: { ok: false, code: "rite-tree-unreadable", message: "rite-tree-unreadable: no checkout" } });
    expect(await riteKukulu(g.ports, {})).toMatchObject({ code: 1, data: { begun: false, refusal: "rite-tree-unreadable" } });
    expect(g.calls.some((c) => c.startsWith("raise"))).toBe(false);
  });
});

describe("kukulu-asks-a-route-only-where-the-day-owes-one", () => {
  it("RED (operator ruling 2026-11-20): with a kukulu lei standing on a lit pūlama's closure, a seat with no terminal flows the whole rite with no prompt and no seat check", async () => {
    const f = fakes({ tty: false, reading: LIT });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, BEGIN, OFFER, `raise ${HEAD}`, LAND]);
    expect(out).toMatchObject({ code: 0, data: { begun: true, landed: true, par: true } });
    expect(out.data).not.toHaveProperty("awaits");
  });

  it("RED: a moved closure, no pūlama, or an unlit one, with no terminal, stops before any lei spends and names the hand act; CONTROL: on a terminal the rite walks on, and the light rides the restand", async () => {
    for (const reading of [{ pulama: "moved" as const, lit: true }, { pulama: "absent" as const }, { pulama: "level" as const, lit: false }]) {
      const f = fakes({ tty: false, reading });
      const out = await riteKukulu(f.ports, {});
      expect(f.calls, JSON.stringify(reading)).toEqual(["checkout", STAGE]);
      expect(out).toMatchObject({ code: 0, data: { begun: false, awaits: "hand", hand: "lares rite kukulu" } });
      expect(f.said.join("\n")).toMatch(/light reads your route on a terminal[\s\S]*your hand: lares rite kukulu on a terminal/);
    }
    const t = fakes({ tty: true, reading: { pulama: "moved", lit: true } });
    expect((await riteKukulu(t.ports, {})).code).toBe(0);
    expect(t.calls).toEqual(["checkout", STAGE, BEGIN, OFFER, `raise ${HEAD}`, LAND]);
  });

  it("RED: no lei and an image the pūlama never admitted, with no terminal, stops before the raise and names the hand act; CONTROL: an admission, or an offer resting from an earlier run, raises with no route", async () => {
    const f = fakes({ tty: false, begin: ABSENT, reading: LIT });
    expect(await riteKukulu(f.ports, {})).toMatchObject({ code: 0, data: { begun: false, awaits: "hand" } });
    expect(f.calls.some((c) => c.startsWith("raise"))).toBe(false);
    expect(f.said.join("\n")).toMatch(/has not admitted the image of aaaaaaaaaaaa, no kukulu lei carries it[\s\S]*lares lei kui --rite kukulu --branch main/);
    for (const reading of [{ ...LIT, admitted: true }, { ...LIT, offer: true }]) {
      const g = fakes({ tty: false, begin: ABSENT, reading });
      expect(await riteKukulu(g.ports, {})).toMatchObject({ code: 0, data: { begun: false, raised: true } });
    }
  });

  it("RED: a quiet day (the vessel already runs the image, the pūlama lit) spends no lei: no begin, and the restand only tops up the unlock and the face", async () => {
    const f = fakes({ tty: false, reading: { ...LIT, current: true } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, `raise ${HEAD}`]);
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, begun: false, quiet: true } });
    expect(f.said.join("\n")).toMatch(/the vessel already runs the image of aaaaaaaaaaaa; no rite spends a return/);
  });

  it("RED: with no vessel standing no rite begins, and the raise reads what rests; a pūlama that reads unknown stops before anything spends", async () => {
    const f = fakes({ reading: { vessel: "down" } });
    expect(await riteKukulu(f.ports, {})).toMatchObject({ code: 0, data: { begun: false, raised: true } });
    expect(f.calls).toEqual(["checkout", STAGE, `raise ${HEAD}`]);
    const u = fakes({ reading: { pulama: "unread" } });
    expect(await riteKukulu(u.ports, {})).toMatchObject({ code: 1, data: { stopped: "pulama", refusal: "kukulu-pulama-unread" } });
    expect(u.calls).toEqual(["checkout", STAGE]);
  });
});

describe("kukulu-fast-forwards-the-checkout", () => {
  it("RED: a sync that stops ends the rite before the image; CONTROL: one that goes on says its line and the walk follows", async () => {
    const f = fakes();
    const stop = await riteKukulu({ ...f.ports, sync: async () => { f.calls.push("sync"); return { ok: false, line: "main and origin/main diverged (1 ahead, 2 behind)" }; } }, {});
    expect(f.calls).toEqual(["sync"]);
    expect(stop).toMatchObject({ code: 1, data: { stopped: "checkout", refusal: "kukulu-checkout-stops" } });
    expect(f.said).toContain("kūkulu: main and origin/main diverged (1 ahead, 2 behind)");
    const g = fakes();
    await riteKukulu({ ...g.ports, sync: async () => { g.calls.push("sync"); return { ok: true, line: "main fast-forwarded" }; } }, {});
    expect(g.calls.slice(0, 3)).toEqual(["sync", "checkout", STAGE]);
  });

  it("RED: the plan fast-forwards only a clean branch behind its upstream; a dirty tree behind, a diverged branch, or a detached head stops by name; level, ahead or no upstream builds the head", () => {
    const at = (s: Partial<Parameters<typeof syncPlan>[0]>) => syncPlan({ branch: "main", upstream: "origin/main", ahead: 0, behind: 0, dirty: false, ...s });
    expect(at({ behind: 3 })).toEqual({ act: "fast-forward" });
    expect(at({ behind: 3, dirty: true })).toMatchObject({ act: "stop", line: expect.stringMatching(/3 behind origin\/main beside uncommitted changes/) });
    expect(at({ behind: 2, ahead: 1 })).toMatchObject({ act: "stop", line: expect.stringMatching(/diverged \(1 ahead, 2 behind\)/) });
    expect(at({ branch: "HEAD" })).toMatchObject({ act: "stop", line: expect.stringMatching(/detached head/) });
    expect(at({})).toMatchObject({ act: "stand", line: "main stands level with origin/main" });
    expect(at({ dirty: true })).toMatchObject({ act: "stand" });
    expect(at({ ahead: 2 })).toMatchObject({ act: "stand" });
    expect(at({ upstream: null })).toMatchObject({ act: "stand", line: expect.stringMatching(/follows no upstream/) });
  });

  describe("the live fast-forward, against scratch repos", () => {
    const scratch: string[] = [];
    afterEach(() => { for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true }); });
    const git = (cwd: string, ...a: string[]) => spawnSync("git", ["-C", cwd, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { encoding: "utf8" });
    /** An upstream repo with one commit, a clone tracking it, and a second commit landed upstream after the clone. */
    const behind = (): { up: string; clone: string } => {
      const root = mkdtempSync("/tmp/lares-kukulu-sync-"); scratch.push(root);
      const up = join(root, "up"), clone = join(root, "clone");
      mkdirSync(up); git(up, "init", "-q", "-b", "main"); writeFileSync(join(up, "a.txt"), "1\n"); git(up, "add", "."); git(up, "commit", "-qm", "one");
      spawnSync("git", ["clone", "-q", up, clone]);
      writeFileSync(join(up, "a.txt"), "2\n"); git(up, "commit", "-qam", "two");
      return { up, clone };
    };
    const head = (dir: string) => git(dir, "rev-parse", "HEAD").stdout.trim();

    it("RED: a clean clone behind its upstream fast-forwards to it, on its own branch", async () => {
      const { up, clone } = behind();
      const out = await syncCheckout(clone);
      expect(out.ok).toBe(true);
      expect(out.line).toMatch(/main fast-forwarded 1 commit\(s\) from origin\/main/);
      expect(head(clone)).toBe(head(up));
      expect(git(clone, "rev-parse", "--abbrev-ref", "HEAD").stdout.trim()).toBe("main");
    });

    it("RED: a dirty clone behind stops and moves nothing; a diverged clone stops; a detached head stops", async () => {
      const dirty = behind();
      const was = head(dirty.clone);
      writeFileSync(join(dirty.clone, "a.txt"), "local\n");
      const d = await syncCheckout(dirty.clone);
      expect(d).toMatchObject({ ok: false, line: expect.stringMatching(/beside uncommitted changes[\s\S]*nothing moved/) });
      expect(head(dirty.clone)).toBe(was);
      const div = behind();
      writeFileSync(join(div.clone, "b.txt"), "x\n"); git(div.clone, "add", "."); git(div.clone, "commit", "-qm", "mine");
      expect(await syncCheckout(div.clone)).toMatchObject({ ok: false, line: expect.stringMatching(/diverged \(1 ahead, 1 behind\)/) });
      const det = behind();
      git(det.clone, "checkout", "-q", "--detach");
      expect(await syncCheckout(det.clone)).toMatchObject({ ok: false, line: expect.stringMatching(/detached head/) });
    });

    const fileAllowed = { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "protocol.file.allow", GIT_CONFIG_VALUE_0: "always" };
    const withFileAllowed = async (run: () => Promise<void>): Promise<void> => {
      Object.assign(process.env, fileAllowed);
      try { await run(); } finally { for (const k of Object.keys(fileAllowed)) delete process.env[k]; }
    };
    /** A superproject with one submodule, cloned; then upstream moves the submodule's pin one commit on. */
    const pinned = (): { clone: string; was: string; now: string } => {
      const root = mkdtempSync("/tmp/lares-kukulu-pin-"); scratch.push(root);
      const sub = join(root, "sub"), up = join(root, "up"), clone = join(root, "clone");
      mkdirSync(sub); git(sub, "init", "-q", "-b", "main"); writeFileSync(join(sub, "s.txt"), "1\n"); git(sub, "add", "."); git(sub, "commit", "-qm", "s1");
      mkdirSync(up); git(up, "init", "-q", "-b", "main"); writeFileSync(join(up, "a.txt"), "1\n"); git(up, "add", "."); git(up, "commit", "-qm", "one");
      git(up, "submodule", "add", "-q", sub, "vendor"); git(up, "commit", "-qm", "pin");
      spawnSync("git", ["clone", "-q", "--recurse-submodules", up, clone], { env: process.env });
      const was = head(join(clone, "vendor"));
      writeFileSync(join(sub, "s.txt"), "2\n"); git(sub, "commit", "-qam", "s2");
      git(join(up, "vendor"), "pull", "-q"); git(up, "commit", "-qam", "move the pin");
      return { clone, was, now: head(join(up, "vendor")) };
    };

    it("RED: after the fast-forward each submodule sits at the commit the superproject records, and the line names it from..to; already current with a pin that differs, the same", () => withFileAllowed(async () => {
      const p = pinned();
      const out = await syncCheckout(p.clone);
      expect(out.ok).toBe(true);
      expect(head(join(p.clone, "vendor"))).toBe(p.now);
      expect(out.line).toContain(`vendor ${p.was.slice(0, 12)}..${p.now.slice(0, 12)}`);
      git(join(p.clone, "vendor"), "checkout", "-q", p.was);
      const again = await syncCheckout(p.clone);
      expect(again.ok).toBe(true);
      expect(head(join(p.clone, "vendor"))).toBe(p.now);
      expect(again.line).toContain(`vendor ${p.was.slice(0, 12)}..${p.now.slice(0, 12)}`);
    }));

    it("RED: a submodule whose pin did not move but holds local or untracked work is named in the answer, never blocks and never discards; CONTROL: a clean one is not named", () => withFileAllowed(async () => {
      const p = pinned();
      expect((await syncCheckout(p.clone)).ok).toBe(true);
      const sub = join(p.clone, "vendor");
      const clean = await syncCheckout(p.clone);
      expect(clean.ok).toBe(true);
      expect(clean.line).not.toMatch(/vendor/);
      writeFileSync(join(sub, "s.txt"), "mine\n");
      writeFileSync(join(sub, "new.txt"), "mine\n");
      const out = await syncCheckout(p.clone);
      expect(out.ok).toBe(true);
      expect(out.line).toMatch(/submodule vendor holds local or untracked changes at its pin/);
      expect(out.line).not.toContain("\n");
      expect(head(sub)).toBe(p.now);
      expect(readFileSync(join(sub, "s.txt"), "utf8")).toBe("mine\n");
      expect(readFileSync(join(sub, "new.txt"), "utf8")).toBe("mine\n");
    }));

    it("RED: a submodule with local or untracked changes stops the rite with one line naming it, and its work stays", () => withFileAllowed(async () => {
      for (const touch of [(d: string) => writeFileSync(join(d, "s.txt"), "mine\n"), (d: string) => writeFileSync(join(d, "new.txt"), "mine\n")]) {
        const p = pinned();
        touch(join(p.clone, "vendor"));
        const out = await syncCheckout(p.clone);
        expect(out.ok).toBe(false);
        expect(out.line).toMatch(/submodule vendor/);
        expect(out.line).not.toContain("\n");
        expect(head(join(p.clone, "vendor"))).toBe(p.was);
        expect(git(join(p.clone, "vendor"), "status", "--porcelain").stdout).not.toBe("");
      }
    }));
  });
});

describe("kukulu-rolls-back", () => {
  it("RED: `--rollback` alone stages the image that ran before, never syncs the checkout, and the rite runs at that image's revision; `--rollback <rev>` stages that revision", async () => {
    const OLD = "b".repeat(40);
    const f = fakes({ reading: { revision: OLD, how: "kept" } });
    const out = await riteKukulu({ ...f.ports, sync: async () => { f.calls.push("sync"); return { ok: true, line: "x" }; }, seedOffer: async () => { f.calls.push("seed"); return null; } }, { rollback: true });
    expect(f.calls).toEqual(["checkout", `stage ${JSON.stringify({ prior: true })}`, `rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: OLD })}`, `rite-offer ${JSON.stringify({ branch: "main", head: OLD, image: IMAGE })}`, `raise ${OLD}`, `rite-land ${JSON.stringify({ tessera: TESSERA, head: OLD, face: 0 })}`]);
    expect(out).toMatchObject({ code: 0, data: { head: OLD, rollback: true, par: true } });
    const g = fakes({ reading: { revision: OLD } });
    await riteKukulu(g.ports, { rollback: "bbbbbbbbbbbb" });
    expect(g.calls[1]).toBe(`stage ${JSON.stringify({ at: "bbbbbbbbbbbb" })}`);
  });

  it("RED: `--rollback` reads bare as the image that ran before and with a word as that revision; a word that names no revision refuses by usage; CONTROL: absent, the rite runs forward", () => {
    const of = (...line: string[]) => rollbackOf(parseArgs(["rite", "kukulu", ...line]));
    expect(of("--rollback")).toEqual({ rollback: true });
    expect(of("--rollback", "--face", "0")).toEqual({ rollback: true });
    expect(of("--rollback", "0123456789ab")).toEqual({ rollback: "0123456789ab" });
    expect(of("--rollback=")).toEqual({ rollback: true });
    expect(of()).toEqual({});
    expect(() => of("--rollback=-x")).toThrow(RiteUsage);
  });
});

describe("a spent lei offers its refill inline", () => {
  const spent: RiteVerbAnswer = { ok: false, code: "swarm-lei-returns-spent", message: "this lei's returns ran out; a fresh lei restrings it" };
  it("RED: a begin stopped on a spent kukulu lei strings the refill the port offers and begins again; unstrung, it keeps the refusal and names the plain line (no cid)", async () => {
    const f = fakes();
    let begins = 0;
    const row = f.ports.row;
    const refilled: unknown[] = [];
    const ports: RitePorts = { ...f.ports, row: async (verb, args) => (verb === "rite-begin" && begins++ === 0 ? spent : row(verb, { ...args })), refill: async (req) => { refilled.push(req); return { strung: true, remedy: "x" }; } };
    expect((await riteKukulu(ports, { face: 0 })).code).toBe(0);
    expect(refilled).toEqual([{ rite: "kukulu", branch: "main", face: 0 }]);
    const g = fakes({ begin: spent });
    const out = await riteKukulu({ ...g.ports, refill: async () => ({ strung: false, remedy: "lares lei kui --rite kukulu --branch main --returns 3 --all" }) }, {});
    expect(out).toMatchObject({ code: 1, data: { begun: false, refusal: "swarm-lei-returns-spent" } });
    expect(g.said.join("\n")).toContain("string more by hand: lares lei kui --rite kukulu --branch main --returns 3 --all");
    expect(g.said.join("\n")).not.toMatch(/[0-9a-f]{64}/);
  });

  it("RED: the live refill asks only a real terminal, names the spent lei's returns, runs `lei kui` with them and no cid on a yes; a pipe is asked nothing and reads the plain line", async () => {
    const asks: string[] = [], ran: string[][] = [];
    const req = { rite: "keep", branch: "house-backup", face: 0 } as const;
    const tty = hostRefill(async (q) => { asks.push(q); return true; }, async (argv) => { ran.push([...argv]); return 0; }, () => true, async () => 6);
    expect(await tty(req)).toEqual({ strung: true, remedy: "lares lei kui --rite keep --branch house-backup --returns 6 --face 0" });
    expect(asks).toEqual(["the keep lei for house-backup is spent; string 6 more under your route?"]);
    expect(ran).toEqual([["lei", "kui", "--rite", "keep", "--branch", "house-backup", "--returns", "6", "--face", "0"]]);
    asks.length = 0; ran.length = 0;
    const pipe = hostRefill(async (q) => { asks.push(q); return true; }, async (argv) => { ran.push([...argv]); return 0; }, () => false, async () => 6);
    expect(await pipe(req)).toEqual({ strung: false, remedy: "lares lei kui --rite keep --branch house-backup --returns 6 --face 0" });
    expect([asks, ran]).toEqual([[], []]);
    const no = hostRefill(async () => false, async () => 0, () => true, async () => 6);
    expect((await no(req)).strung).toBe(false);
  });
});

describe("the vessel that stands locked lands later", () => {
  it("RED: a landing the locked vessel refuses ends the rite clean, names the unlock and the landing still owed, and reads no par", async () => {
    const f = fakes({ land: { ok: false, code: "vessel-locked", message: "this vessel's key rests unopened" } });
    const out = await riteKukulu(f.ports, {});
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, tesserae: [{ face: "h0", tessera: TESSERA }], begun: true, landed: false, awaits: "unlock" } });
    expect(f.said.join("\n")).toMatch(new RegExp(`lares vault unlock[\\s\\S]*lares rite land --tessera ${TESSERA} --head ${HEAD} --face 0`));
  });

  it("RED: any other landing refusal ends the rite red under its own code", async () => {
    const out = await riteKukulu(fakes({ land: { ok: false, code: "rite-begun-absent", message: "rite-begun-absent: none" } }).ports, {});
    expect(out).toMatchObject({ code: 1, data: { landed: false, refusal: "rite-begun-absent" } });
  });
});

describe("lares rite plans one store row per vessel sub-verb", () => {
  it("begin names its rite, branch and head and no tree; land names its tessera and head; receipts names nothing", () => {
    expect(plan("begin", "--rite", "kukulu", "--branch", "main", "--head", HEAD)).toEqual({ verb: "rite-begin", args: { rite: "kukulu", branch: "main", head: HEAD } });
    expect(plan("land", "--tessera", TESSERA, "--head", HEAD, "--face", "1")).toEqual({ verb: "rite-land", args: { tessera: TESSERA, head: HEAD, face: 1 } });
    expect(plan("receipts")).toEqual({ verb: "rite-receipts", args: {} });
    expect(plan("begin", "--rite", "keep", "--branch", "backup", "--head", "c".repeat(64), "--staging", ".house.keep-0a")).toEqual({ verb: "rite-begin", args: { rite: "keep", branch: "backup", head: "c".repeat(64), staged: ".house.keep-0a" } });
  });

  it("RED: the burned `receipt` sub-verb plans no row and refuses by usage; CONTROL: `receipts` still plans its row", () => {
    expect(() => plan("receipt", "--tree", "b".repeat(40))).toThrow(RiteUsage);
    expect(plan("receipts")).toEqual({ verb: "rite-receipts", args: {} });
  });

  it("RED: an unknown sub-verb and a line that lacks a name refuse by usage; `kukulu` plans no single row", () => {
    for (const line of [[], ["restart"], ["begin", "--rite", "kukulu", "--branch", "main"], ["begin", "--branch", "main", "--head", HEAD], ["land", "--head", HEAD], ["land", "--tessera", TESSERA], ["kukulu"]]) {
      expect(() => plan(...line), line.join(" ")).toThrow(RiteUsage);
    }
  });
});

describe("the rite runs on the host, and its rows in the vessel", () => {
  const route = (argv: string[]) => decideRoute({
    argv, env: { HOME: "/home/op" }, commands: COMMAND_NAMES, shim: "/clone/tools/lares-container.sh", tty: false,
    fsProbe: { exists: () => true },
  });

  it("RED: `rite kukulu` (and its spelling `kūkulu`) stays on this machine, where the shim stands; CONTROL: begin, land and receipts forward into the vessel", () => {
    expect(route(["rite", "kukulu"])).toBe("local");
    expect(route(["rite", "kūkulu", "--branch", "main"])).toBe("local");
    expect(route(["rite", "kukulu", "--rollback"])).toBe("local");
    for (const sub of ["begin", "land", "receipts", "offer"]) expect(route(["rite", sub, "--json"]), sub).toBe("forward");
  });

  it("RED: `rite keep` (the keep's host half: git in the operator's workspace clone) stays on this machine; CONTROL: its vessel half `rite keep-cut` forwards", () => {
    expect(route(["rite", "keep", "--workspace", "backup"])).toBe("local");
    expect(route(["rite", "keep-cut", "--workspace", "backup", "--json"])).toBe("forward");
  });
});

describe("kukulu-offer-reaches-the-new-vessel (the host's step)", () => {
  it("RED: a standing vessel that writes no offer stays standing: no raise, and the answer names the offer; a reading that names no digest goes on and says so", async () => {
    const f = fakes();
    const row = f.ports.row;
    f.ports.row = async (verb, args) => verb === "rite-offer" ? { ok: false, code: "swarm-lei-absent", message: "no kukulu lei rests" } : row(verb, args);
    const out = await riteKukulu(f.ports, {});
    expect(f.calls.some((c) => c.startsWith("raise"))).toBe(false);
    expect(out).toMatchObject({ code: 1, data: { begun: true, landed: false, stopped: "offer", refusal: "swarm-lei-absent" } });
    const none = fakes({ reading: { image: "" } });
    const went = await riteKukulu(none.ports, {});
    expect(went.code).toBe(0);
    expect(none.calls.some((c) => c.startsWith("rite-offer"))).toBe(false);
    expect(none.said.join("\n")).toMatch(/no offer rests for a pūlama/);
  });

  it("RED: the begin and the offer gather every lent face in the vessel, so the host names no face on them; each landing names the face its tessera began under", () => {
    expect(hostRowLine("rite-offer", { branch: "main", head: HEAD, image: IMAGE })).toEqual(["rite", "offer", "--branch", "main", "--head", HEAD, "--image", IMAGE]);
    expect(hostRowLine("rite-begin", { rite: "kukulu", branch: "main", head: HEAD })).toEqual(["rite", "begin", "--rite", "kukulu", "--branch", "main", "--head", HEAD]);
    expect(hostRowLine("rite-land", { tessera: TESSERA, head: HEAD, face: 2 })).toEqual(["rite", "land", "--tessera", TESSERA, "--head", HEAD, "--face", "2"]);
  });

  it("RED: a begin over several lent faces lands each face's tessera under that face, names each face that waits for its lei, and reads par only where every pair reads par", async () => {
    const T2 = "2".repeat(64);
    const f = fakes({ begin: { ok: true, output: { rite: "kukulu", faces: [{ face: "h0", ordinal: 0, tessera: TESSERA }, { face: "h2", ordinal: 2, tessera: T2 }], waits: ["h1"] } } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls.filter((c) => c.startsWith("rite-land"))).toEqual([
      `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD, face: 0 })}`,
      `rite-land ${JSON.stringify({ tessera: T2, head: HEAD, face: 2 })}`,
    ]);
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, tesserae: [{ face: "h0", tessera: TESSERA }, { face: "h2", tessera: T2 }], waits: ["h1"], begun: true, landed: true, par: true } });
    expect(f.said.join("\n")).toMatch(/h1 carries no kukulu lei on this line and waits/);
    // One face's pair reading red reads the whole landing red.
    const red = fakes({ begin: { ok: true, output: { rite: "kukulu", faces: [{ face: "h0", ordinal: 0, tessera: TESSERA }, { face: "h2", ordinal: 2, tessera: T2 }], waits: [] } } });
    const row = red.ports.row;
    red.ports.row = async (verb, args) => verb === "rite-land" && args["face"] === 2 ? { ok: true, output: { par: false } } : row(verb, args);
    expect(await riteKukulu(red.ports, {})).toMatchObject({ code: 1, data: { landed: true, par: false } });
  });

  it("RED: every kūkulu that raises names the image it replaced as `prior: {revision, tag}`, and an off-par landing prints the ONE command that raises it again as `wayBack` (the rite rolled back to it); CONTROL: a par landing names no way back, and no prior port leaves the answer as it stood", async () => {
    const PRIOR = { revision: "b".repeat(40), tag: "lares-surface:rev-bbbbbbbbbbbb" };
    const par = fakes();
    par.ports.prior = async () => PRIOR;
    const ok = await riteKukulu(par.ports, {});
    expect(ok.data).toMatchObject({ par: true, prior: PRIOR });
    expect(ok.data).not.toHaveProperty("wayBack");
    expect(par.said.join("\n")).toMatch(/replaced image keeps the tag lares-surface:rev-bbbbbbbbbbbb/);
    const red = fakes();
    red.ports.prior = async () => PRIOR;
    const row = red.ports.row;
    red.ports.row = async (verb, args) => verb === "rite-land" ? { ok: true, output: { par: false } } : row(verb, args);
    const off = await riteKukulu(red.ports, {});
    expect(off).toMatchObject({ code: 1, data: { landed: true, par: false, prior: PRIOR, wayBack: "lares rite kukulu --rollback bbbbbbbbbbbb" } });
    expect(red.said.join("\n")).toMatch(/run: lares rite kukulu --rollback bbbbbbbbbbbb/);
    const stopped = fakes({ raise: 9 });
    stopped.ports.prior = async () => PRIOR;
    expect((await riteKukulu(stopped.ports, {})).data).toMatchObject({ stopped: "raise", prior: PRIOR });
    const bare = await riteKukulu(fakes().ports, {});
    expect(bare.data).not.toHaveProperty("prior");
  });

  it("RED: the prior image's tag follows the shim's rule (`rev-<12 hex of the revision label>`, `rev-unlabeled-<12 hex of the id>` where none); CONTROL: no image names no prior", () => {
    expect(priorImageRef("lares-surface:local", "c".repeat(40), "sha256:" + "d".repeat(64))).toEqual({ revision: "c".repeat(40), tag: "lares-surface:rev-cccccccccccc" });
    expect(priorImageRef("lares-surface:local", "", "sha256:" + "d".repeat(64))).toEqual({ revision: "unlabeled", tag: "lares-surface:rev-unlabeled-dddddddddddd" });
    expect(priorImageRef("reg.io:5000/lares-surface", "c".repeat(40), "sha256:" + "d".repeat(64)).tag).toBe("reg.io:5000/lares-surface:rev-cccccccccccc");
  });

  it("RED: the host names each face the offer vouches for, and each face whose line carries no lei waits by name", async () => {
    const f = fakes();
    const row = f.ports.row;
    f.ports.row = async (verb, args) => verb === "rite-offer" ? { ok: true, output: { lei: 2, faces: ["h0", "h1", "h2"], waits: ["h2"] } } : row(verb, args);
    await riteKukulu(f.ports, {});
    const said = f.said.join("\n");
    expect(said).toMatch(/2 lei, a vouch for each of h0, h1, h2/);
    expect(said).toMatch(/h2 carries no lei on this line and waits/);
  });

  it("the offer sub-verb plans its store row", () => {
    expect(plan("offer", "--branch", "main", "--head", HEAD, "--image", IMAGE)).toEqual({ verb: "rite-offer", args: { branch: "main", head: HEAD, image: IMAGE } });
    expect(() => plan("offer", "--branch", "main", "--head", HEAD)).toThrow(RiteUsage);
  });
});

describe("the kūkulu names the seed the image offers beside the founding record (D1)", () => {
  const record = { engine: "e1", grammar: "g1", plugins: "p1", floor: "f1" };
  const seed = { cid: "5".repeat(64), digests: { engine: "e1", grammar: "g2", plugins: "p1", floor: "f1" } };

  it("RED: before any lei spends, the host says the seed (offered) at the head beside the founding record, ratchet by ratchet; the rows and the shim order stay as they were", async () => {
    const f = fakes();
    const ports: RitePorts = { ...f.ports, seedOffer: async (head) => { f.calls.push(`seed-offer ${head}`); return { record, seed }; } };
    const out = await riteKukulu(ports, {});
    expect(f.calls.filter((c) => !c.startsWith("seed-offer"))).toEqual(["checkout", STAGE, BEGIN, OFFER, `raise ${HEAD}`, LAND]);
    expect(f.calls.indexOf(`seed-offer ${HEAD}`)).toBeLessThan(f.calls.indexOf(BEGIN));
    const line = kukuluSeedLine(HEAD, { record, seed });
    expect(line).toBe(`kūkulu: the image at ${HEAD} offers seed ${"5".repeat(64)} beside the founding record: a newer seed waits: engine same · grammar moved · plugins same · floor same; the founding record keeps serving, and the kūkulu moves no ratchet`);
    expect(f.said).toContain(line);
    expect(out).toMatchObject({ code: 0, data: { seed: { cid: "5".repeat(64), ratchets: "engine same · grammar moved · plugins same · floor same" } } });
  });

  it("CONTROL: a seed the same on every ratchet says so; a host that reads no founding record names that and the rite goes on", async () => {
    expect(kukuluSeedLine(HEAD, { record, seed: { cid: seed.cid, digests: record } }))
      .toBe(`kūkulu: the image at ${HEAD} offers seed ${seed.cid}: same on every ratchet as the founding record`);
    const f = fakes();
    const out = await riteKukulu({ ...f.ports, seedOffer: async () => null }, {});
    expect(f.said).toContain("kūkulu: the host reads no founding record beside the seed this image offers; the rite goes on, and moves no ratchet");
    expect(out.code).toBe(0);
    expect(out.data["seed"]).toBeUndefined();
  });
});

describe("the kūkulu's seed port reads the genesis dir the image carries (the host seed read)", () => {
  const SHIPPED = join(repoRoot, "genesis");
  const shippedBytes = (): Buffer => readFileSync(join(SHIPPED, "seed.json"));
  const record = (): GenesisDigests => foundingRecordDigests(JSON.parse(shippedBytes().toString("utf8")) as GenesisRecordLike);
  const scratch: string[] = [];
  afterEach(() => { for (const d of scratch.splice(0)) rmSync(d, { recursive: true, force: true }); });
  const genesisDirWith = (bytes: string | Buffer): string => {
    const root = mkdtempSync("/tmp/lares-kukulu-seed-"); scratch.push(root);
    mkdirSync(join(root, "genesis")); writeFileSync(join(root, "genesis", "seed.json"), bytes);
    return join(root, "genesis");
  };

  it("RED: the wired port says the seed the genesis dir offers, by its CID, beside the founding record the house answers", async () => {
    const dir = genesisDirWith(shippedBytes());
    const cid = genesisSeedCid(new Uint8Array(shippedBytes()));
    const f = fakes();
    const out = await riteKukulu({ ...f.ports, seedOffer: hostSeedOfferPort({ genesisDir: dir, record: async () => ({ record: record() }) }) }, {});
    expect(f.said).toContain(`kūkulu: the image at ${HEAD} offers seed ${cid}: same on every ratchet as the founding record`);
    expect(out.data["seed"]).toEqual({ cid, ratchets: "engine same · grammar same · plugins same · floor same" });
  });

  it("CONTROL: a newer seed names what waits; a house that answers no founding record leaves the port null, and the rite goes on", async () => {
    const seed = JSON.parse(shippedBytes().toString("utf8")) as { blobs: Record<string, Record<string, unknown>> };
    const moved = JSON.stringify({ ...seed, blobs: { ...seed.blobs, [LARES_MEMETIC_WIKITEXT_PLUGIN_URI]: { ...seed.blobs[LARES_MEMETIC_WIKITEXT_PLUGIN_URI], sha256: "f".repeat(64) } } });
    const f = fakes();
    await riteKukulu({ ...f.ports, seedOffer: hostSeedOfferPort({ genesisDir: genesisDirWith(moved), record: async () => ({ record: record() }) }) }, {});
    expect(f.said.join("\n")).toContain("a newer seed waits: engine same · grammar moved · plugins same · floor same; the founding record keeps serving, and the kūkulu moves no ratchet");
    const g = fakes();
    const out = await riteKukulu({ ...g.ports, seedOffer: hostSeedOfferPort({ genesisDir: genesisDirWith(shippedBytes()), record: async () => ({ unread: "no vessel answers" }) }) }, {});
    expect(g.said).toContain("kūkulu: the host reads no founding record beside the seed this image offers; the rite goes on, and moves no ratchet");
    expect(out.code).toBe(0);
  });
});

/**
 * KŪKULU SURVIVES A CTRL+C (gate 2, beta-release-zero, operator ruling 2026-11-20). The live red: a Ctrl+C at the census's
 * accept-loss prompt, then a re-run, began AGAIN (a second lei return spent, new tesserae minted, the offer written again). The
 * rite now reads the begin that stands before it begins: at this head it RESUMES it (no return, no tessera, the offer that
 * rests reused); at another head it refuses by name with the one line that clears it.
 */
describe("kukulu-survives-a-ctrl-c", () => {
  const OLD = "b".repeat(40);
  const AT = "2026-11-20T04:12:09Z";
  type Begin = { face: string; ordinal?: number; tessera: string; head: string };
  const STANDING = (head = HEAD): Begin[] => [{ face: "h0", ordinal: 0, tessera: TESSERA, head }];
  const STANDS = "standing main";
  /** The fake ports with a standing read: what the standing vessel answers before the raise, and what the new one answers after. */
  function standingFakes(before: readonly Begin[] | null, over: Parameters<typeof fakes>[0] = {}, after: readonly Begin[] = []) {
    const f = fakes(over);
    let raised = false;
    const raise = f.ports.raise;
    f.ports.raise = async (rev) => { raised = true; return raise(rev); };
    f.ports.standing = async (branch) => {
      f.calls.push(`standing ${branch}`);
      return before === null ? { ok: false, code: "vessel-locked", message: "this vessel's key rests unopened" } : { ok: true, begins: raised ? after : before };
    };
    return f;
  }

  it("RED: a begin already standing at this head and image is RESUMED: no begin row (no lei return spent, no tessera minted), the offer that rests reused, the raise, then the landing reads par; the line names it plainly", async () => {
    const f = standingFakes(STANDING(), { reading: { offer: true, offerAt: AT } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, STANDS, `raise ${HEAD}`, LAND]);
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, tesserae: [{ face: "h0", tessera: TESSERA }], resumed: true, begun: true, landed: true, par: true } });
    const said = f.said.join("\n");
    expect(said).toMatch(new RegExp(`kūkulu: resuming the begin of ${AT}; no lei spent \\(h0 tessera ${TESSERA}\\)`));
    expect(said).toMatch(/the offer the begin rested still stands for the next vessel over sha256:abab[0-9a-f]*; reused, none written/);
    expect(said).not.toMatch(/kūkulu: begun;/);
  });

  it("RED: resuming where no offer rests for the image (the stop came before the offer) writes the offer once and still spends no return; the line names the head where no time reads", async () => {
    const f = standingFakes(STANDING());
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, STANDS, OFFER, `raise ${HEAD}`, LAND]);
    expect(out).toMatchObject({ code: 0, data: { resumed: true, landed: true, par: true } });
    expect(f.said.join("\n")).toMatch(/kūkulu: resuming the begin at aaaaaaaaaaaa; no lei spent/);
  });

  it("RED: a begun-but-never-landed rite older than the new head (the operator pulled meanwhile) refuses by name with the one line that clears it, never stacks: no begin, no offer, no raise", async () => {
    const f = standingFakes(STANDING(OLD));
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, STANDS]);
    expect(out).toMatchObject({ code: 1, data: { begun: false, stopped: "begun-stale", refusal: "kukulu-begun-stale", stale: [{ face: "h0", tessera: TESSERA, head: OLD }] } });
    const said = f.said.join("\n");
    expect(said).toMatch(/a kūkulu begun at bbbbbbbbbbbb stands unlanded \(h0 tessera c+\), and this run raises aaaaaaaaaaaa; it never stacks a second begin/);
    expect(said).toMatch(/clear it with: lares rite kukulu --rollback bbbbbbbbbbbb \(it lands that begin at its own head and spends no lei\), then run lares rite kukulu again; nothing spent, nothing moved/);
    // CONTROL: the line it names resumes that begin at its own head (the rollback stands the old revision's image).
    const back = standingFakes(STANDING(OLD), { reading: { revision: OLD, current: true } });
    const cleared = await riteKukulu(back.ports, { rollback: OLD.slice(0, 12) });
    expect(back.calls).toEqual(["checkout", `stage ${JSON.stringify({ at: OLD.slice(0, 12) })}`, STANDS, `raise ${OLD}`, `rite-land ${JSON.stringify({ tessera: TESSERA, head: OLD, face: 0 })}`]);
    expect(cleared).toMatchObject({ code: 0, data: { resumed: true, landed: true, par: true } });
  });

  it("RED: a quiet day (the vessel already runs the image) with a begin standing at this head lands it after the top-up, spending nothing; CONTROL: a quiet day with none standing lands nothing", async () => {
    const f = standingFakes(STANDING(), { reading: { ...LIT, current: true } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, STANDS, `raise ${HEAD}`, LAND]);
    expect(out).toMatchObject({ code: 0, data: { quiet: true, resumed: true, landed: true, par: true } });
    const none = standingFakes([], { reading: { ...LIT, current: true } });
    expect(await riteKukulu(none.ports, {})).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, begun: false, quiet: true } });
    expect(none.calls).toEqual(["checkout", STAGE, STANDS, `raise ${HEAD}`]);
  });

  it("RED: with no vessel standing at the start (a Ctrl+C at the light left it down), the raise stands the new vessel and the rite lands the begun halves it reads there; CONTROL: none standing there lands nothing", async () => {
    const f = standingFakes([], { reading: { vessel: "down", offer: true } }, STANDING());
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, `raise ${HEAD}`, STANDS, LAND]);
    expect(out).toMatchObject({ code: 0, data: { resumed: true, landed: true, par: true } });
    const none = standingFakes([], { reading: { vessel: "down" } });
    expect(await riteKukulu(none.ports, {})).toMatchObject({ code: 0, data: { begun: false, raised: true } });
    expect(none.calls).toEqual(["checkout", STAGE, `raise ${HEAD}`, STANDS]);
  });

  it("RED: a standing read the vessel refuses stops before anything spends, naming the refusal; never a second begin over an unread line", async () => {
    const f = standingFakes(null);
    expect(await riteKukulu(f.ports, {})).toMatchObject({ code: 1, data: { begun: false, stopped: "standing", refusal: "vessel-locked" } });
    expect(f.calls).toEqual(["checkout", STAGE, STANDS]);
    expect(f.said.join("\n")).toMatch(/reads no begun halves \(this vessel's key rests unopened\); nothing spent, nothing moved/);
  });

  it("RED: a Ctrl+C during the restand (the shim answers 130) names the interrupt and the resume, never a lost return", async () => {
    const f = standingFakes([], { raise: 130 });
    const out = await riteKukulu(f.ports, {});
    expect(out).toMatchObject({ code: 1, data: { begun: true, landed: false, stopped: "raise", interrupted: true } });
    expect(f.said.join("\n")).toMatch(/kūkulu: interrupted during the restand; the begun halves rest and the offer stands, so `lares rite kukulu` resumes them and spends no lei/);
  });

  /** A fake house that holds its state across runs: the stage reads it, each row and the raise move it. */
  function house(interruptAt: "accept-loss" | "light" | "admit") {
    const st = { vessel: "standing" as "standing" | "down", current: false, offer: false, guests: [] as string[], landed: new Set<string>(), begins: 0, offers: 0, raises: 0 };
    const said: string[] = [];
    const ports: RitePorts = {
      checkout: async () => ({ head: HEAD, branch: "main" }),
      stage: async () => ({ code: 0, reading: { ...READING, vessel: st.vessel, current: st.current, offer: st.offer } }),
      standing: async () => ({ ok: true, begins: st.vessel === "standing" ? st.guests.filter((t) => !st.landed.has(t)).map((tessera) => ({ face: "h0", ordinal: 0, tessera, head: HEAD })) : [] }),
      raise: async () => {
        st.raises++;
        if (st.raises === 1) {
          // THE INTERRUPT: accept-loss stops before the down (the vessel stands); the light after it (the vessel down); the admit after the up.
          if (interruptAt === "light") st.vessel = "down";
          if (interruptAt === "admit") st.current = true;
          return 130;
        }
        st.vessel = "standing"; st.current = true;
        return 0;
      },
      row: async (verb, args) => {
        if (verb === "rite-begin") { st.begins++; const tessera = String(st.begins).repeat(64); st.guests.push(tessera); return { ok: true, output: { rite: "kukulu", faces: [{ face: "h0", ordinal: 0, tessera }], waits: [] } }; }
        if (verb === "rite-offer") { st.offers++; st.offer = true; return { ok: true, output: { lei: 1, faces: ["h0"], waits: [] } }; }
        st.landed.add(String(args["tessera"]));
        return { ok: true, output: { par: true } };
      },
      say: (line) => { said.push(line); },
    };
    return { st, ports, said };
  }

  for (const at of ["accept-loss", "light", "admit"] as const) {
    it(`RED: a Ctrl+C at the ${at} prompt, then a re-run, lands par: one begin across both runs, one offer, no second return`, async () => {
      const h = house(at);
      expect(await riteKukulu(h.ports, {})).toMatchObject({ code: 1, data: { stopped: "raise", interrupted: true } });
      const again = await riteKukulu(h.ports, {});
      expect(again).toMatchObject({ code: 0, data: { resumed: true, landed: true, par: true } });
      expect([h.st.begins, h.st.offers, h.st.guests.length, h.st.landed.size]).toEqual([1, 1, 1, 1]);
      expect(h.said.filter((l) => l.startsWith("kūkulu: begun;"))).toHaveLength(1);
      // CONTROL: a third run reads nothing standing, and the quiet day spends nothing.
      expect(await riteKukulu(h.ports, {})).toMatchObject({ code: 0, data: { begun: false, quiet: true } });
      expect(h.st.begins).toBe(1);
    });
  }

  it("RED: the host's standing read takes the vessel's `standing` rows, each landing under its face; an older vessel's receipts answer reads its conferre's unlanded kūkulu halves on the line", () => {
    expect(standingOf({ rite: "kukulu", standing: [{ face: "h2", ordinal: 2, tessera: TESSERA, branch: "main", head: HEAD }] }, "main")).toEqual([{ face: "h2", ordinal: 2, tessera: TESSERA, head: HEAD }]);
    expect(standingOf({ receipts: [], conferre: { par: [], red: [
      { tessera: TESSERA, rite: "kukulu", begun: "e", landed: null, branch: "main", head: HEAD, par: false, red: "landed-absent" },
      { tessera: "d".repeat(64), rite: "kukulu", begun: "e", landed: null, branch: "other", head: HEAD, par: false, red: "landed-absent" },
      { tessera: "f".repeat(64), rite: "kukulu", begun: "e", landed: "g", branch: "main", head: HEAD, par: false, red: "head-differs" },
      { tessera: "9".repeat(64), rite: "keep", begun: "e", landed: null, branch: "main", head: HEAD, par: false, red: "landed-absent" },
    ] } }, "main")).toEqual([{ face: "the worn face", tessera: TESSERA, head: HEAD }]);
    expect(hostRowLine("rite-receipts", { rite: "kukulu", branch: "main" })).toEqual(["rite", "receipts", "--rite", "kukulu", "--branch", "main"]);
    expect(plan("receipts", "--rite", "kukulu", "--branch", "main")).toEqual({ verb: "rite-receipts", args: { rite: "kukulu", branch: "main" } });
  });
});
