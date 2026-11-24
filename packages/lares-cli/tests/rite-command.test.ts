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
import { RiteUsage, hostRefill, leiReading, hostRowLine, ritePlan, rollbackOf, standingOf, standingRowLine, syncCheckout } from "../src/commands/rite.js";
import { storeVerbRidesWorn } from "../src/store-door.js";
import { KUKULU_LEI_RETURNS, kukuluSeedLine, priorImageRef, riteKukulu, syncPlan, type RitePorts, type RiteVerbAnswer, type StandReading } from "../src/rite-kukulu.js";
import { decideRoute } from "../src/host-bridge.js";
import { COMMAND_NAMES, COMMANDS, unknownFlags } from "../src/bin/lares.js";

const HEAD = "a".repeat(40), TESSERA = "c".repeat(64), IMAGE = "sha256:" + "ab".repeat(32);
const plan = (...line: string[]) => ritePlan(parseArgs(["rite", ...line]));
/** The shim's reading of a house with no pūlama, the vessel standing on an older image, the image built at HEAD. */
const READING: StandReading = { revision: HEAD, image: IMAGE, how: "built", vessel: "standing", current: false, pulama: "off", lit: null, admitted: null, offer: false };
/** A pūlama lit on a closure that stands, the image neither admitted nor offered. */
const LIT: Partial<StandReading> = { pulama: "closure-level", lit: true, admitted: false };

/** Ports that record every call in order and answer from a script. */
function fakes(over: { begin?: RiteVerbAnswer; land?: RiteVerbAnswer; reading?: Partial<StandReading>; stage?: number; raise?: number; tty?: boolean; keeper?: { to: string; closure: string } | null; leiStands?: boolean | string; leiSpend?: boolean } = {}) {
  const calls: string[] = [], said: string[] = [];
  const ports: RitePorts = {
    checkout: async () => { calls.push("checkout"); return { head: HEAD, branch: "main" }; },
    stage: async (target) => { calls.push(`stage ${JSON.stringify(target)}`); return { code: over.stage ?? 0, reading: { ...READING, ...over.reading } }; },
    raise: async (rev, keeper) => { calls.push(`raise ${rev}${keeper ? ` --keeper-to ${keeper.to}` : ""}`); return over.raise ?? 0; },
    ...(over.keeper === undefined ? {} : { keeperStand: async () => { calls.push("keeper-stand"); return over.keeper ?? null; } }),
    ...(over.leiStands === undefined ? {} : { leiStands: async () => over.leiStands as boolean | string }),
    ...(over.leiSpend === undefined ? {} : { keeperLeiSpend: async (rev: string, branch: string) => { calls.push(`keeper-lei-spend ${rev} ${branch}`); return over.leiSpend as boolean; } }),
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
const BEGIN = `rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD, image: IMAGE })}`;
const OFFER = `rite-offer ${JSON.stringify({ branch: "main", head: HEAD, image: IMAGE })}`;
const LAND = `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD, image: IMAGE, face: 0 })}`;
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
    expect(f.calls[2]).toBe(`rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD, image: IMAGE, face: 0 })}`);
    expect(f.calls[3]).toBe(`rite-offer ${JSON.stringify({ branch: "main", head: HEAD, image: IMAGE, face: 0 })}`);
    const bare = fakes();
    await riteKukulu(bare.ports, {});
    expect(bare.calls[2]).toBe(BEGIN);
  });

  it("RED: a restand that fails ends the rite, names the landing the begun half waits on, and that the rite picks up from where the house stands; CONTROL: a `--branch` names the line", async () => {
    const f = fakes({ raise: 9 });
    const out = await riteKukulu(f.ports, { branch: "feature/x" });
    expect(f.calls[2]).toBe(`rite-begin ${JSON.stringify({ rite: "kukulu", branch: "feature/x", head: HEAD, image: IMAGE })}`);
    expect(out).toMatchObject({ code: 1, data: { begun: true, landed: false, stopped: "raise" } });
    expect(f.said.join("\n")).toMatch(new RegExp(`picks up from where the house stands; the lei's return stays spent[\\s\\S]*lares rite land --tessera ${TESSERA} --head ${HEAD} --image ${IMAGE} --face 0`));
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

  it("RED: a moved closure a keeper commit names vests with no terminal: the successor stands before the offer, the vouches name the move, and the raise carries its key; CONTROL: a struck fire due, an unlit keeper, no lei to ride, or no keeper-stand still owes the light", async () => {
    const to = "c".repeat(64), closure = "sha256:" + "9".repeat(64);
    const f = fakes({ tty: false, reading: { pulama: "moved", lit: true, keeper: "vests" }, keeper: { to, closure } });
    expect((await riteKukulu(f.ports, {})).code).toBe(0);
    const offer = `rite-offer ${JSON.stringify({ branch: "main", head: HEAD, image: IMAGE, keeperTo: to, keeperNext: closure })}`;
    expect(f.calls).toEqual(["checkout", STAGE, BEGIN, "keeper-stand", offer, `raise ${HEAD} --keeper-to ${to}`, LAND]);
    for (const over of [
      { reading: { pulama: "moved" as const, lit: true, keeper: "struck-due" as const }, keeper: { to, closure } },
      { reading: { pulama: "moved" as const, lit: false, keeper: "vests" as const }, keeper: { to, closure } },
      { reading: { pulama: "moved" as const, lit: true, keeper: "vests" as const }, keeper: { to, closure }, leiStands: "absent" },
      { reading: { pulama: "moved" as const, lit: true, keeper: "vests" as const } },
    ]) {
      const g = fakes({ tty: false, ...over });
      expect(await riteKukulu(g.ports, {}), JSON.stringify(over)).toMatchObject({ code: 0, data: { begun: false, awaits: "hand" } });
      expect(g.calls.filter((c) => c.startsWith("raise") || c === "keeper-stand")).toEqual([]);
    }
  });

  it("RED: a moved closure no commit names yet rests a keeper commit the standing kukulu lei licenses, with no terminal and no count of its own, then rides the keeper move as a hand's commit would; CONTROL: a refused commit names the hand line and raises nothing, and a kukulu lei absent or spent licenses none", async () => {
    const to = "c".repeat(64), closure = "sha256:" + "9".repeat(64);
    const f = fakes({ tty: false, reading: { pulama: "moved", lit: true, keeper: "lei" }, keeper: { to, closure }, leiSpend: true, leiStands: true });
    expect((await riteKukulu(f.ports, {})).code).toBe(0);
    const offer = `rite-offer ${JSON.stringify({ branch: "main", head: HEAD, image: IMAGE, keeperTo: to, keeperNext: closure })}`;
    expect(f.calls).toEqual(["checkout", "checkout", STAGE, `keeper-lei-spend ${HEAD} main`, BEGIN, "keeper-stand", offer, `raise ${HEAD} --keeper-to ${to}`, LAND]);
    expect(f.said.join("\n")).toMatch(/the kukulu lei on main licenses a keeper commit naming the closure of a{12}; the rite's return spends on it, and the living fire passes with no route/);
    const refused = fakes({ tty: false, reading: { pulama: "moved", lit: true, keeper: "lei" }, keeper: { to, closure }, leiSpend: false, leiStands: true });
    expect(await riteKukulu(refused.ports, {})).toMatchObject({ code: 0, data: { begun: false, awaits: "hand" } });
    expect(refused.calls).toEqual(["checkout", "checkout", STAGE, `keeper-lei-spend ${HEAD} main`]);
    expect(refused.said.join("\n")).toMatch(/the keeper rested no commit under the kukulu lei[\s\S]*lares pulama keeper-commit[\s\S]*your hand: lares rite kukulu on a terminal/);
    for (const leiStands of ["absent", "returns-spent"]) {
      const dry = fakes({ tty: false, reading: { pulama: "moved", lit: true, keeper: "lei" }, keeper: { to, closure }, leiSpend: true, leiStands });
      expect(await riteKukulu(dry.ports, {}), leiStands).toMatchObject({ code: 0, data: { begun: false, awaits: "hand" } });
      expect(dry.calls.filter((c) => c.startsWith("keeper-lei-spend") || c.startsWith("raise")), leiStands).toEqual([]);
    }
  });

  it("RED: a successor that stands no key leaves the rite with no keeper move: the offer names none and the raise carries none (it relights struck)", async () => {
    const f = fakes({ tty: true, reading: { pulama: "moved", lit: true, keeper: "vests" }, keeper: null });
    expect((await riteKukulu(f.ports, {})).code).toBe(0);
    expect(f.calls).toEqual(["checkout", STAGE, BEGIN, "keeper-stand", OFFER, `raise ${HEAD}`, LAND]);
    expect(f.said.join("\n")).toMatch(/no successor keeper stood beside the lit one/);
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
    expect(f.calls).toEqual(["checkout", `stage ${JSON.stringify({ prior: true })}`, `rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: OLD, image: IMAGE })}`, `rite-offer ${JSON.stringify({ branch: "main", head: OLD, image: IMAGE })}`, `raise ${OLD}`, `rite-land ${JSON.stringify({ tessera: TESSERA, head: OLD, image: IMAGE, face: 0 })}`]);
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

describe("kukulu reads its lei first", () => {
  it("RED: no kukulu lei on the line reads FIRST, before the fetch, the image step and the seed, and the offer strings one on a yes; the begin then runs", async () => {
    const f = fakes();
    const refilled: unknown[] = [];
    const ports: RitePorts = {
      ...f.ports,
      sync: async () => { f.calls.push("sync"); return { ok: true, line: "main stands at origin/main" }; },
      seedOffer: async () => { f.calls.push("seed"); return null; },
      leiStands: async (branch) => { f.calls.push(`lei ${branch}`); return false; },
      refill: async (req) => { f.calls.push("string"); refilled.push(req); return { strung: true, remedy: "x" }; },
    };
    expect((await riteKukulu(ports, {})).code).toBe(0);
    expect(f.calls.slice(0, 6)).toEqual(["checkout", "lei main", "string", "sync", "checkout", STAGE]);
    expect(refilled).toEqual([{ rite: "kukulu", branch: "main", absent: true, returns: KUKULU_LEI_RETURNS, all: true }]);
    expect(f.calls).toContain(BEGIN);
  });

  it("a lei that stands asks nothing; a declined offer names the plain line up front and the restand goes on as before", async () => {
    const f = fakes();
    await riteKukulu({ ...f.ports, leiStands: async () => true, refill: async () => { f.calls.push("string"); return { strung: true, remedy: "x" }; } }, {});
    expect(f.calls).not.toContain("string");
    const g = fakes();
    await riteKukulu({ ...g.ports, leiStands: async () => false, refill: async () => ({ strung: false, remedy: "lares lei kui --rite kukulu --branch main --returns 6 --all" }) }, {});
    expect(g.said[0]).toMatch(/no kukulu lei stands on main/);
    expect(g.said[0]).toContain("lares lei kui --rite kukulu --branch main --returns 6 --all");
  });

  it("RED: only an absent lei offers a stringing; a spent lei waits for the begin's refill, and a fork or ward refusal names its own clearing line", async () => {
    const run = async (reading: boolean | string | null) => {
      const f = fakes();
      const offered: unknown[] = [];
      await riteKukulu({ ...f.ports, leiStands: async () => reading, refill: async (req) => { if (req.absent === true) offered.push(req); return { strung: false, remedy: "r" }; } }, {});
      return { f, offered: offered.length };
    };
    expect((await run("absent")).offered).toBe(1);
    const spent = await run("returns-spent");
    expect(spent.offered).toBe(0);
    expect(spent.f.said.filter((l) => /stands not/.test(l))).toEqual([]);
    const forked = await run("forked");
    expect(forked.offered).toBe(0);
    expect(forked.f.said[0]).toMatch(/stands not \(forked\).*lares lei kui --rite kukulu --branch main --returns \d+ --all/);
    const ward = await run("ward-act-uncosigned");
    expect(ward.offered).toBe(0);
    expect(ward.f.said[0]).toMatch(/stands not \(ward-act-uncosigned\).*lares lei show --rite kukulu --branch main/);
    for (const r of ["unstrung", "returned", "head-mismatch"]) expect((await run(r)).f.said[0]).toContain("a fresh lei restrings the line");
  });

  it("the host reads `lei show` into the refusal code it carries: absent only where every face reads absent, a standing lei with no return left as spent", () => {
    expect(leiReading({ lei: { standing: true, returnsLeft: 2 } })).toBe(true);
    expect(leiReading({ lei: { standing: false, refusal: "absent" } })).toBe("absent");
    expect(leiReading({ lei: { standing: false, refusal: "returns-spent" } })).toBe("returns-spent");
    expect(leiReading({ lei: { standing: true, returnsLeft: 0 } })).toBe("returns-spent");
    expect(leiReading({ lei: { standing: false, refusal: "forked" } })).toBe("forked");
    expect(leiReading({ lei: { standing: false, refusal: "ward-act-uncosigned" } })).toBe("ward-act-uncosigned");
    expect(leiReading({ faces: [{ lei: { standing: false, refusal: "absent" } }, { lei: { standing: false, refusal: "absent" } }] })).toBe("absent");
    expect(leiReading({ faces: [{ lei: { standing: false, refusal: "absent" } }, { lei: { standing: false, refusal: "forked" } }] })).toBe("forked");
    expect(leiReading({ faces: [{ lei: { standing: false, refusal: "absent" } }, { lei: { standing: true, returnsLeft: 1 } }] })).toBe(true);
    expect(leiReading({ lei: { standing: false } })).toBeNull();
    expect(leiReading({})).toBeNull();
  });

  it("the live offer for an absent lei asks a real terminal to string one under this passphrase, per lent face, and runs `lei kui --all`", async () => {
    const asks: string[] = [], ran: string[][] = [];
    const tty = hostRefill(async (q) => { asks.push(q); return true; }, async (argv) => { ran.push([...argv]); return 0; }, () => true, async () => null);
    expect((await tty({ rite: "kukulu", branch: "main", absent: true, returns: 6, all: true })).strung).toBe(true);
    expect(asks).toEqual(["no kukulu lei stands on main; string a kukulu lei (6 returns per lent face) under this passphrase?"]);
    expect(ran).toEqual([["lei", "kui", "--rite", "kukulu", "--branch", "main", "--returns", "6", "--all"]]);
  });
});

describe("the vessel that stands locked lands later", () => {
  it("RED: a landing the locked vessel refuses ends the rite clean, names the unlock and the landing still owed, and reads no par", async () => {
    const f = fakes({ land: { ok: false, code: "vessel-locked", message: "this vessel's key rests unopened" } });
    const out = await riteKukulu(f.ports, {});
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, tesserae: [{ face: "h0", tessera: TESSERA }], begun: true, landed: false, awaits: "unlock" } });
    expect(f.said.join("\n")).toMatch(new RegExp(`lares vault unlock[\\s\\S]*lares rite land --tessera ${TESSERA} --head ${HEAD} --image ${IMAGE} --face 0`));
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
      `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD, image: IMAGE, face: 0 })}`,
      `rite-land ${JSON.stringify({ tessera: T2, head: HEAD, image: IMAGE, face: 2 })}`,
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

  it("RED: the offer carries the keeper move the vessel reads: `--keeper-to <64 hex> --keeper-next sha256:<64 hex>` plan `keeperTo`/`keeperNext`; CONTROL: one without the other, or a malformed key or closure, refuses by usage and names the cure", () => {
    const to = "d".repeat(64), closure = "sha256:" + "e".repeat(64);
    expect(plan("offer", "--branch", "main", "--head", HEAD, "--image", IMAGE, "--keeper-to", to, "--keeper-next", closure))
      .toEqual({ verb: "rite-offer", args: { branch: "main", head: HEAD, image: IMAGE, keeperTo: to, keeperNext: closure } });
    const base = ["offer", "--branch", "main", "--head", HEAD, "--image", IMAGE];
    for (const extra of [["--keeper-to", to], ["--keeper-next", closure], ["--keeper-to", "D".repeat(64), "--keeper-next", closure], ["--keeper-to", to, "--keeper-next", "e".repeat(64)]]) {
      expect(() => plan(...base, ...extra), extra.join(" ")).toThrow(/--keeper-to <64 hex> --keeper-next sha256:<64 hex>/);
    }
  });

  it("RED: every row the kūkulu sends crosses the CLI whole: the line the host writes passes the flag gate and plans back into the very args the rite sent (the keeper move included)", () => {
    const rite = COMMANDS.find((c) => c.name === "rite")!;
    const to = "d".repeat(64), closure = "sha256:" + "e".repeat(64);
    const rows: Array<["rite-begin" | "rite-land" | "rite-offer" | "rite-receipts", Record<string, unknown>]> = [
      ["rite-begin", { rite: "kukulu", branch: "main", head: HEAD, image: IMAGE, face: 0 }],
      ["rite-offer", { branch: "main", head: HEAD, image: IMAGE, face: 0, keeperTo: to, keeperNext: closure }],
      ["rite-offer", { branch: "main", head: HEAD, image: IMAGE }],
      ["rite-land", { tessera: TESSERA, head: HEAD, image: IMAGE, face: 2 }],
      ["rite-receipts", { rite: "kukulu", branch: "main", face: 0 }],
    ];
    for (const [verb, rowArgs] of rows) {
      const parsed = parseArgs(hostRowLine(verb, rowArgs));
      expect(unknownFlags(rite, parsed), verb).toEqual([]);
      expect(ritePlan(parsed), verb).toEqual({ verb, args: rowArgs });
    }
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
 * rite now reads the debt that stands before it begins: every kūkulu half resting unlanded on the line (by its raw rows, so a
 * face shut or rehived since still counts), beside the halves a lent face can land and the offer's vouches. A debt that
 * matches this run (its head, the image the host made, every half landable) RESUMES: no return, no tessera, the offer reused
 * only where its vouches match. Any other debt refuses by name with the lines that clear it (a hand landing), never stacks.
 */
describe("kukulu-survives-a-ctrl-c", () => {
  const OLD = "b".repeat(40), D2 = "sha256:" + "d2".repeat(32);
  const AT = "2026-11-20T04:12:09Z";
  type Begin = { face: string; ordinal?: number; tessera: string; head: string; image?: string };
  type Pending = { tessera: string; group: string; head: string; image?: string; face?: string };
  type Vouch = { face?: string; group: string; branch: string; head: string; image: string };
  const BEGUN = (head = HEAD, image: string | undefined = IMAGE): Begin[] => [{ face: "h0", ordinal: 0, tessera: TESSERA, head, ...(image === undefined ? {} : { image }) }];
  const pendingOf = (begins: readonly Begin[]): Pending[] => begins.map((b) => ({ tessera: b.tessera, group: `g-${b.face}`, head: b.head, face: b.face, ...(b.image === undefined ? {} : { image: b.image }) }));
  const VOUCH = (over: Partial<Vouch> = {}): Vouch[] => [{ face: "h0", group: "g-h0", branch: "main", head: HEAD, image: IMAGE, ...over }];
  type Read = { begins: readonly Begin[]; pending?: readonly Pending[]; offer?: readonly Vouch[] | null };
  const read = (begins: readonly Begin[], more: Partial<Read> = {}): Read => ({ begins, pending: pendingOf(begins), offer: null, ...more });
  const STANDS = "standing main";
  const LANDI = `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD, image: IMAGE, face: 0 })}`;
  /** The fake ports with a standing read: what the standing vessel answers before the raise, and what the new one answers after. */
  function standingFakes(before: Read | null, over: Parameters<typeof fakes>[0] = {}, after: Read = read([])) {
    const f = fakes(over);
    let raised = false;
    const raise = f.ports.raise;
    f.ports.raise = async (rev) => { raised = true; return raise(rev); };
    f.ports.standing = async (branch, face) => {
      f.calls.push(`standing ${branch}${face === undefined ? "" : ` face ${face}`}`);
      return before === null && !raised ? { ok: false, code: "vessel-locked", message: "this vessel's key rests unopened" } : { ok: true, ...(raised ? after : before ?? read([])) };
    };
    f.ports.keepOwed = async () => { f.calls.push("keep-owed"); return 0; };
    return f;
  }

  it("RED: a begin already standing at this head and image, its offer vouching for it, is RESUMED: no begin row (no lei return spent, no tessera minted), the offer reused, the raise, the landing over that image, then the keep the down left owed", async () => {
    const f = standingFakes(read(BEGUN(), { offer: VOUCH() }), { reading: { offer: true, offerAt: AT } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, STANDS, `raise ${HEAD}`, LANDI, "keep-owed"]);
    expect(out).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, tesserae: [{ face: "h0", tessera: TESSERA }], resumed: true, begun: true, landed: true, par: true } });
    const said = f.said.join("\n");
    expect(said).toMatch(new RegExp(`kūkulu: resuming the begin of ${AT}; no lei spent \\(h0 tessera ${TESSERA}\\)`));
    expect(said).toMatch(/the offer the begin rested still vouches for each pending face over sha256:abab[0-9a-f]*; reused, none written/);
    expect(said).not.toMatch(/kūkulu: begun;/);
  });

  it("RED: offer reuse matches the vouches to the pending halves: an offer for another branch, another image, or no offer at all writes the offer afresh (still no begin); CONTROL: the line names the head where no time reads", async () => {
    for (const offer of [VOUCH({ branch: "other" }), VOUCH({ image: D2 }), null]) {
      const f = standingFakes(read(BEGUN(), { offer }), { reading: { offer: true } });
      const out = await riteKukulu(f.ports, {});
      expect(f.calls, JSON.stringify(offer)).toEqual(["checkout", STAGE, STANDS, OFFER, `raise ${HEAD}`, LANDI, "keep-owed"]);
      expect(out).toMatchObject({ code: 0, data: { resumed: true, landed: true, par: true } });
      expect(f.said.join("\n")).toMatch(/kūkulu: resuming the begin at aaaaaaaaaaaa; no lei spent/);
    }
  });

  it("RED: a begin standing at this head over ANOTHER image (the host rebuilt the head as another digest) refuses `kukulu-begun-unmatched` by name, naming the hand landing that clears it; never a fresh offer, never a false par", async () => {
    const f = standingFakes(read(BEGUN(HEAD, D2), { offer: VOUCH({ image: D2 }) }));
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, STANDS]);
    expect(out).toMatchObject({ code: 1, data: { begun: false, stopped: "begun-unmatched", refusal: "kukulu-begun-unmatched" } });
    const said = f.said.join("\n");
    expect(said).toMatch(new RegExp(`h0 tessera ${TESSERA} \\(begun at aaaaaaaaaaaa over ${D2}: another image than this run raises, sha256:abab`));
    expect(said).toMatch(/clear it with: land each by hand where the vessel stands \(conferre reads it red\): lares rite land --tessera c+ --head <the head the vessel runs> --face 0; the abandon that ends a half by name waits on its own branch \(develop--a-begun-rite-sets-down\); nothing spent, nothing moved/);
  });

  it("RED: a begun-but-never-landed rite older than the new head refuses `kukulu-begun-stale` by name with the hand landing, and the rollback that lands it at its own head carries `--branch`; never stacks: no begin, no offer, no raise", async () => {
    const f = standingFakes(read(BEGUN(OLD)));
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, STANDS]);
    expect(out).toMatchObject({ code: 1, data: { begun: false, stopped: "begun-stale", refusal: "kukulu-begun-stale", stale: [{ face: "h0", tessera: TESSERA, head: OLD }] } });
    const said = f.said.join("\n");
    expect(said).toMatch(/h0 tessera c+ \(begun at bbbbbbbbbbbb over sha256:abab[0-9a-f]*: another head than this run raises, aaaaaaaaaaaa\); it never stacks a second begin/);
    expect(said).toMatch(/clear it with: land each by hand where the vessel stands \(conferre reads it red\): lares rite land --tessera c+ --head <the head the vessel runs> --face 0; the abandon that ends a half by name waits on its own branch \(develop--a-begun-rite-sets-down\); or land it at its own head: lares rite kukulu --rollback bbbbbbbbbbbb --branch main; nothing spent, nothing moved/);
  });

  it("RED: two pending heads name the hand landings alone (each rollback would refuse on the other); a half whose face stands shut or rehived (pending, and no lent face lands it) refuses by its group, waiting for its face", async () => {
    const two = standingFakes(read([...BEGUN(OLD), { face: "h1", ordinal: 1, tessera: "9".repeat(64), head: "e".repeat(40), image: IMAGE }]));
    expect(await riteKukulu(two.ports, {})).toMatchObject({ code: 1, data: { refusal: "kukulu-begun-stale" } });
    expect(two.said.join("\n")).toMatch(/clear it with: land each by hand where the vessel stands \(conferre reads it red\): lares rite land --tessera c+ --head <the head the vessel runs> --face 0; lares rite land --tessera 9+ --head <the head the vessel runs> --face 1;/);
    expect(two.said.join("\n")).not.toMatch(/--rollback/);
    const shut = standingFakes({ begins: [], pending: [{ tessera: TESSERA, group: "old-group-h1", head: HEAD, image: IMAGE }], offer: null });
    expect(await riteKukulu(shut.ports, {})).toMatchObject({ code: 1, data: { refusal: "kukulu-begun-unmatched" } });
    expect(shut.said.join("\n")).toMatch(new RegExp(`old-group-h1 tessera ${TESSERA} \\(begun at aaaaaaaaaaaa over sha256:abab[0-9a-f]*: its face stands shut or rehived, so no lent face lands it\\)[\\s\\S]*old-group-h1 tessera ${TESSERA} waits for its face to stand again`));
  });

  it("RED: a quiet day (the vessel already runs the image) with a matched begin standing lands it after the top-up, spending nothing; CONTROL: a quiet day with none standing lands nothing", async () => {
    const f = standingFakes(read(BEGUN(), { offer: VOUCH() }), { reading: { ...LIT, current: true } });
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, STANDS, `raise ${HEAD}`, LANDI, "keep-owed"]);
    expect(out).toMatchObject({ code: 0, data: { quiet: true, resumed: true, landed: true, par: true } });
    const none = standingFakes(read([]), { reading: { ...LIT, current: true } });
    expect(await riteKukulu(none.ports, {})).toEqual({ code: 0, data: { rite: "kukulu", branch: "main", head: HEAD, begun: false, quiet: true } });
    expect(none.calls).toEqual(["checkout", STAGE, STANDS, `raise ${HEAD}`, "keep-owed"]);
  });

  it("RED: with no vessel standing at the start (a Ctrl+C at the light left it down), the raise stands the new vessel and the rite lands the matched halves it reads there; a stale debt it reads there exits NON-ZERO by name; CONTROL: none standing lands nothing", async () => {
    const f = standingFakes(read([]), { reading: { vessel: "down", offer: true } }, read(BEGUN()));
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, `raise ${HEAD}`, STANDS, LANDI, "keep-owed"]);
    expect(out).toMatchObject({ code: 0, data: { resumed: true, landed: true, par: true } });
    const stale = standingFakes(read([]), { reading: { vessel: "down" } }, read(BEGUN(OLD)));
    expect(await riteKukulu(stale.ports, {})).toMatchObject({ code: 1, data: { raised: true, refusal: "kukulu-begun-stale" } });
    expect(stale.said.join("\n")).toMatch(/lares rite land --tessera/);
    const none = standingFakes(read([]), { reading: { vessel: "down" } });
    expect(await riteKukulu(none.ports, {})).toMatchObject({ code: 0, data: { begun: false, raised: true } });
    expect(none.calls).toEqual(["checkout", STAGE, `raise ${HEAD}`, STANDS, "keep-owed"]);
  });

  it("RED: a Ctrl+C at the admit leaves the new image standing locked at the floor: the locked standing read routes to the shim's re-admit (the raise), and the rite lands what the opened vessel reads; CONTROL: a locked vessel on another image still stops before anything spends", async () => {
    const f = standingFakes(null, { reading: { ...LIT, current: true } }, read(BEGUN()));
    const out = await riteKukulu(f.ports, {});
    expect(f.calls).toEqual(["checkout", STAGE, STANDS, `raise ${HEAD}`, STANDS, LANDI, "keep-owed"]);
    expect(out).toMatchObject({ code: 0, data: { resumed: true, landed: true, par: true } });
    expect(f.said.join("\n")).toMatch(/the standing vessel stands locked at the floor, so its begun halves read nowhere yet; the restand opens it \(its admit where owed\), and the rite lands what it reads then/);
    const g = standingFakes(null);
    expect(await riteKukulu(g.ports, {})).toMatchObject({ code: 1, data: { begun: false, stopped: "standing", refusal: "vessel-locked" } });
    expect(g.calls).toEqual(["checkout", STAGE, STANDS]);
    expect(g.said.join("\n")).toMatch(/reads no begun halves \(this vessel's key rests unopened\); nothing spent, nothing moved/);
  });

  it("RED: the standing read always names a face, so a house with three faces open never reads FaceNotNamed: the operator's face where named, else face 0", () => {
    expect(standingRowLine("main")).toEqual(["rite", "receipts", "--rite", "kukulu", "--branch", "main", "--face", "0"]);
    expect(standingRowLine("main", 2)).toEqual(["rite", "receipts", "--rite", "kukulu", "--branch", "main", "--face", "2"]);
  });

  it("RED: the standing read and the begin name the face the operator names; the begin and each landing carry the image the host made", async () => {
    const f = standingFakes(read([]));
    await riteKukulu(f.ports, { face: 2 });
    expect(f.calls[2]).toBe("standing main face 2");
    expect(f.calls[3]).toBe(`rite-begin ${JSON.stringify({ rite: "kukulu", branch: "main", head: HEAD, image: IMAGE, face: 2 })}`);
    expect(f.calls).toContain(`rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD, image: IMAGE, face: 0 })}`);
  });

  it("RED: a Ctrl+C during the restand (the shim answers 130) names the interrupt and the resume, never a lost return, and keeps nothing before a landing", async () => {
    const f = standingFakes(read([]), { raise: 130 });
    const out = await riteKukulu(f.ports, {});
    expect(out).toMatchObject({ code: 1, data: { begun: true, landed: false, stopped: "raise", interrupted: true } });
    expect(f.said.join("\n")).toMatch(/kūkulu: interrupted during the restand; the begun halves rest and the offer stands, so `lares rite kukulu` resumes them and spends no lei/);
    expect(f.calls).not.toContain("keep-owed");
  });

  /** A fake house that holds its state across runs: the stage reads it, each row and the raise move it. */
  function house(interruptAt: "accept-loss" | "light" | "admit") {
    const st = { vessel: "standing" as "standing" | "down", current: false, locked: false, offer: false, guests: [] as string[], landed: new Set<string>(), begins: 0, offers: 0, raises: 0, keeps: 0 };
    const said: string[] = [];
    const ports: RitePorts = {
      checkout: async () => ({ head: HEAD, branch: "main" }),
      stage: async () => ({ code: 0, reading: { ...READING, vessel: st.vessel, current: st.current, offer: st.offer } }),
      standing: async () => {
        if (st.locked) return { ok: false, code: "vessel-locked", message: "this vessel's key rests unopened" };
        const open = st.vessel === "standing" ? st.guests.filter((t) => !st.landed.has(t)).map((tessera) => ({ face: "h0", ordinal: 0, tessera, head: HEAD, image: IMAGE })) : [];
        return { ok: true, begins: open, pending: pendingOf(open), offer: st.offer ? VOUCH() : null };
      },
      raise: async () => {
        st.raises++;
        if (st.raises === 1) {
          // THE INTERRUPT: accept-loss stops before the down (the vessel stands); the light after it (the vessel down); the admit after
          // the up (the new image standing locked at the floor).
          if (interruptAt === "light") st.vessel = "down";
          if (interruptAt === "admit") { st.current = true; st.locked = true; }
          return 130;
        }
        st.vessel = "standing"; st.current = true; st.locked = false;
        return 0;
      },
      keepOwed: async () => { st.keeps++; return 0; },
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
    it(`RED: a Ctrl+C at the ${at} prompt, then a re-run, lands par: one begin across both runs, one offer, no second return, the keep after the landing`, async () => {
      const h = house(at);
      expect(await riteKukulu(h.ports, {})).toMatchObject({ code: 1, data: { stopped: "raise", interrupted: true } });
      const again = await riteKukulu(h.ports, {});
      expect(again).toMatchObject({ code: 0, data: { resumed: true, landed: true, par: true } });
      expect([h.st.begins, h.st.offers, h.st.guests.length, h.st.landed.size, h.st.keeps]).toEqual([1, 1, 1, 1, 1]);
      expect(h.said.filter((l) => l.startsWith("kūkulu: begun;"))).toHaveLength(1);
      // CONTROL: a third run reads nothing standing, and the quiet day spends nothing.
      expect(await riteKukulu(h.ports, {})).toMatchObject({ code: 0, data: { begun: false, quiet: true } });
      expect(h.st.begins).toBe(1);
    });
  }

  it("RED: the host's standing read takes the vessel's `standing`, `pending` and `offer` rows; an older vessel's receipts answer reads its conferre's unlanded kūkulu halves on the line and names no pending (the older shape)", () => {
    const v = { face: "h2", group: "g2", branch: "main", head: HEAD, image: IMAGE };
    expect(standingOf({ rite: "kukulu", standing: [{ face: "h2", ordinal: 2, tessera: TESSERA, branch: "main", head: HEAD, image: IMAGE }], pending: [{ tessera: TESSERA, group: "g2", branch: "main", head: HEAD, image: IMAGE, face: "h2", lei: "l", n: 1 }], offer: [v] }, "main"))
      .toEqual({ begins: [{ face: "h2", ordinal: 2, tessera: TESSERA, head: HEAD, image: IMAGE }], pending: [{ tessera: TESSERA, group: "g2", head: HEAD, image: IMAGE, face: "h2" }], offer: [v] });
    expect(standingOf({ receipts: [], conferre: { par: [], red: [
      { tessera: TESSERA, rite: "kukulu", begun: "e", landed: null, branch: "main", head: HEAD, par: false, red: "landed-absent" },
      { tessera: "d".repeat(64), rite: "kukulu", begun: "e", landed: null, branch: "other", head: HEAD, par: false, red: "landed-absent" },
      { tessera: "f".repeat(64), rite: "kukulu", begun: "e", landed: "g", branch: "main", head: HEAD, par: false, red: "head-differs" },
      { tessera: "9".repeat(64), rite: "keep", begun: "e", landed: null, branch: "main", head: HEAD, par: false, red: "landed-absent" },
    ] } }, "main")).toEqual({ begins: [{ face: "the worn face", tessera: TESSERA, head: HEAD }] });
    expect(hostRowLine("rite-receipts", { rite: "kukulu", branch: "main", face: 1 })).toEqual(["rite", "receipts", "--rite", "kukulu", "--branch", "main", "--face", "1"]);
    expect(plan("receipts", "--rite", "kukulu", "--branch", "main")).toEqual({ verb: "rite-receipts", args: { rite: "kukulu", branch: "main" } });
    expect(plan("begin", "--rite", "kukulu", "--branch", "main", "--head", HEAD, "--image", IMAGE)).toEqual({ verb: "rite-begin", args: { rite: "kukulu", branch: "main", head: HEAD, image: IMAGE } });
    expect(plan("land", "--tessera", TESSERA, "--head", HEAD, "--image", IMAGE)).toEqual({ verb: "rite-land", args: { tessera: TESSERA, head: HEAD, image: IMAGE } });
  });

  it("RED (the blocker): with three faces lit and none named, the kūkulu's standing read rides the worn face's session as the begin and the offer do, never the refusal for several open; CONTROL: a plain receipts read still names its face", () => {
    for (const [verb, args] of [["rite-begin", {}], ["rite-offer", {}], ["rite-receipts", { rite: "kukulu" }]] as const) expect(storeVerbRidesWorn(verb, args), verb).toBe(true);
    expect(storeVerbRidesWorn("rite-receipts", {})).toBe(false);
    // A LANDING NAMING NO FACE rides the worn face too: the hand-landing line a read with no raw debt names carries no ordinal.
    expect(storeVerbRidesWorn("rite-land", {})).toBe(true);
  });

  it("RED (the third read): the landing names the image the raise actually ran, as the vessel reports it, never the digest captured before the raise; a moved tag says so and lands over the image that runs", async () => {
    const f = standingFakes(read([]));
    f.ports.ranImage = async () => { f.calls.push("ran-image"); return D2; };
    await riteKukulu(f.ports, {});
    expect(f.calls.slice(-3)).toEqual(["ran-image", `rite-land ${JSON.stringify({ tessera: TESSERA, head: HEAD, image: D2, face: 0 })}`, "keep-owed"]);
    expect(f.said.join("\n")).toMatch(new RegExp(`the vessel runs ${D2}, not the image the begin bound \\(sha256:abab[0-9a-f]*\\)`));
    const same = standingFakes(read([]));
    same.ports.ranImage = async () => IMAGE;
    await riteKukulu(same.ports, {});
    expect(same.calls).toContain(LANDI);
    expect(same.said.join("\n")).not.toMatch(/the vessel runs/);
  });

  it("RED: the rollback hint stands only where EVERY pending half shares that one head and lands there; a matched half beside a stale one names the hand landing alone", async () => {
    const f = standingFakes(read([...BEGUN(OLD), { face: "h1", ordinal: 1, tessera: "9".repeat(64), head: HEAD, image: IMAGE }]));
    expect(await riteKukulu(f.ports, {})).toMatchObject({ code: 1, data: { refusal: "kukulu-begun-stale" } });
    expect(f.said.join("\n")).toMatch(/lares rite land --tessera/);
    expect(f.said.join("\n")).not.toMatch(/--rollback/);
  });

  it("RED: a debt read the vessel refuses after the raise exits NON-ZERO by name; CONTROL: a locked new vessel names the unlock and still exits non-zero", async () => {
    const f = standingFakes(read([]), { reading: { vessel: "down" } });
    f.ports.standing = async () => ({ ok: false, code: "face-log-unreadable", message: "h1 loads no log" });
    expect(await riteKukulu(f.ports, {})).toMatchObject({ code: 1, data: { raised: true, refusal: "face-log-unreadable" } });
    const g = standingFakes(read([]), { reading: { vessel: "down" } });
    g.ports.standing = async () => ({ ok: false, code: "vessel-locked", message: "this vessel's key rests unopened" });
    expect(await riteKukulu(g.ports, {})).toMatchObject({ code: 1, data: { raised: true, refusal: "vessel-locked", awaits: "unlock" } });
  });

  it("RED: a standing read that names no raw debt (a vessel of the shape before) reads the debt as UNKNOWN, never empty: it says so and names the data; its hand-landing line rides the worn face", async () => {
    const f = standingFakes({ begins: [] });
    const out = await riteKukulu(f.ports, {});
    expect(out.data).toMatchObject({ debt: "unread" });
    expect(f.said.join("\n")).toMatch(/this vessel reads no raw debt, so a half whose face stands shut or was rehived reads nowhere/);
    // RED (the fourth read): UNREAD DEBT NEVER AUTHORIZES A FRESH BEGIN: the rite raises and reads the debt in the new vessel.
    expect(f.calls).toEqual(["checkout", STAGE, STANDS, `raise ${HEAD}`, STANDS, "keep-owed"]);
    expect(f.said.join("\n")).toMatch(/no begin spends a return while the debt reads unread; the raise stands the new vessel, and the rite reads the debt there/);
    // CONTROL: the halves it does read, at this head, resume (they spend nothing).
    const seen = standingFakes({ begins: BEGUN(HEAD, undefined) });
    expect(await riteKukulu(seen.ports, {})).toMatchObject({ code: 0, data: { resumed: true, landed: true } });
    expect(seen.calls.some((c) => c.startsWith("rite-begin"))).toBe(false);
  });

  it("RED (the fourth read): a reply naming `standing` and no `pending` fills the debt from what it stands, read as unread, never as empty debt", () => {
    expect(standingOf({ rite: "kukulu", standing: [{ face: "h2", ordinal: 2, tessera: TESSERA, branch: "main", head: HEAD }] }, "main")).toEqual({ begins: [{ face: "h2", ordinal: 2, tessera: TESSERA, head: HEAD }] });
  });

  it("RED (the fourth read): an image the raised vessel runs that reads nowhere (a failed inspect) lands nothing and never falls back to the staged digest; the halves wait for the next run", async () => {
    const f = standingFakes(read([]));
    f.ports.ranImage = async () => null;
    const out = await riteKukulu(f.ports, {});
    expect(out).toMatchObject({ code: 1, data: { begun: true, landed: false, refusal: "kukulu-ran-image-unread" } });
    expect(f.calls.some((c) => c.startsWith("rite-land"))).toBe(false);
    expect(f.calls).not.toContain("keep-owed");
    expect(f.said.join("\n")).toMatch(/the image the raised vessel runs reads nowhere, so no landing names it: `lares rite kukulu` lands the halves once it reads, and spends no lei/);
  });

});
