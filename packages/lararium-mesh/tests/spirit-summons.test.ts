/**
 * spirit-summons.test.ts — the mandate summons' pure core: a mandate keyed by its own hash, the one wake line, custody at
 * hand-vs-seat, the coordinator's lane ceiling, and the edge the house keeps.
 * Plan: lar:///ha.ka.ba/kahua/memory/plan/mandate-summons
 */
import { describe, expect, test } from "vitest";
import * as S from "../src/spirit-summons.js";
import { SpiritRefusal } from "../src/spirit-shrine.js";

const M = "lar:///ha.ka.ba/kahua/memory/";
const WORDS = "Read PR 412 cold and hand back three findings.";
const land = (covered: Partial<Record<S.MandateField, string>>, text = WORDS) => {
  const w = S.mandateWrite(covered, text);
  return { w, stored: { ...w.fields, text: w.text } as Record<string, string> };
};
const COORD = land({ pet: "lares-alpha", instance: "00001", offerer: "hand", face: "1", grants: "summons", lanes: "2" }, "Coordinate the arms.");
const coordinator = S.mandateRead(COORD.w.uri, COORD.stored, COORD.w.hash);
const ARM = land({ pet: "cold-reader", instance: "00002", offerer: "lares-alpha#00001", parent: S.refLine(COORD.w.uri, COORD.w.hash), face: "1", model: "claude-fable-5-2", reads: "[tag[ruling]]\n[prefix[lar:///ha.ka.ba/kahua/memory/course/]]", links: `${M}state/handoff`, paths: "packages/lares-cli", "handback-shape": "three findings, one line each" });
const arm = S.mandateRead(ARM.w.uri, ARM.stored, ARM.w.hash);
const refusal = (run: () => unknown): SpiritRefusal => { try { run(); } catch (e) { if (e instanceof SpiritRefusal) return e; throw e; } throw new Error("no refusal"); };

describe("a mandate rests under its own hash", () => {
  test("the title carries the first 16 hex of the hash over its fields and words, and the record carries the whole hash", () => {
    expect(ARM.w.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(ARM.w.uri).toBe(`${M}mandate/${ARM.w.hash.slice(0, 16)}`);
    expect(ARM.w.fields["mandate-hash"]).toBe(ARM.w.hash);
    expect(ARM.w.fields["tags"]).toBe("mandate");
    expect(S.summonsOf(ARM.w.hash)).toBe(`${M}summons/${ARM.w.hash.slice(0, 16)}`);
  });
  test("the same mandate hashes the same; a moved word, model or offerer moves the hash", () => {
    const again = land({ pet: "cold-reader", instance: "00002", offerer: "lares-alpha#00001", parent: S.refLine(COORD.w.uri, COORD.w.hash), face: "1", model: "claude-fable-5-2", reads: "[tag[ruling]]\n[prefix[lar:///ha.ka.ba/kahua/memory/course/]]", links: `${M}state/handoff`, paths: "packages/lares-cli", "handback-shape": "three findings, one line each" });
    expect(again.w.hash).toBe(ARM.w.hash);
    expect(S.mandateHashOf({ ...ARM.stored, model: "claude-opus" }, WORDS)).not.toBe(ARM.w.hash);
    expect(S.mandateHashOf({ ...ARM.stored, offerer: "hand" }, WORDS)).not.toBe(ARM.w.hash);
    expect(S.mandateHashOf(ARM.stored, `${WORDS} And push.`)).not.toBe(ARM.w.hash);
  });
  test("a store that trims the words' tail moves no hash", () => {
    expect(S.mandateHashOf(ARM.stored, `${WORDS}\n\n`)).toBe(ARM.w.hash);
  });
  test("the read hands back every affordance", () => {
    expect(arm).toMatchObject({ pet: "cold-reader", instance: "00002", tag: "cold-reader#00002", offerer: "lares-alpha#00001", face: 1, model: "claude-fable-5-2", launchCap: "claude-cli", paths: ["packages/lares-cli"], lanes: 0, handbackShape: "three findings, one line each" });
    expect(arm.reads).toEqual(["[tag[ruling]]", "[prefix[lar:///ha.ka.ba/kahua/memory/course/]]"]);
    expect(arm.parent).toEqual({ uri: COORD.w.uri, hash: COORD.w.hash });
    expect(coordinator).toMatchObject({ grants: ["summons"], lanes: 2, parent: null });
  });
});

describe("a moved mandate refuses", () => {
  test("words changed since the hash landed refuse mandate-moved, naming the cure", () => {
    const r = refusal(() => S.mandateRead(ARM.w.uri, { ...ARM.stored, text: `${WORDS} Also delete the branch.` }, ARM.w.hash));
    expect(r.code).toBe("mandate-moved");
    expect(r.message).toContain("lares spirit mandate cold-reader#00002");
  });
  test("a covered field changed, a ref naming another hash, and a hash at another address each refuse mandate-moved", () => {
    expect(refusal(() => S.mandateRead(ARM.w.uri, { ...ARM.stored, model: "claude-opus" }, ARM.w.hash)).code).toBe("mandate-moved");
    expect(refusal(() => S.mandateRead(ARM.w.uri, ARM.stored, "0".repeat(64))).code).toBe("mandate-moved");
    expect(refusal(() => S.mandateRead(`${M}mandate/0000000000000000`, ARM.stored, null)).code).toBe("mandate-moved");
  });
  test("no record refuses mandate-unknown", () => {
    expect(refusal(() => S.mandateRead(ARM.w.uri, {}, ARM.w.hash)).code).toBe("mandate-unknown");
  });
  test("a line naming another instance, and another face answering, refuse by name", () => {
    expect(S.mandateNames(arm, "cold-reader", "00002")).toBeNull();
    expect(S.mandateNames(arm, "cold-reader", "00003")?.code).toBe("mandate-names-another");
    expect(S.mandateNames(arm, "other", null)?.code).toBe("mandate-names-another");
    expect(S.mandateFaceTurned(arm, 1, "x")).toBeNull();
    expect(S.mandateFaceTurned(arm, null, "x")).toBeNull();
    const turned = S.mandateFaceTurned(arm, 2, "lares spirit summon x")!;
    expect(turned.code).toBe("mandate-face-turned");
    expect(turned.message).toContain("lares spirit summon x --face 1");
  });
});

describe("the one wake line", () => {
  test("it names who wakes, the om, the mandate by ref, and the face", () => {
    expect(S.wakeLine(arm)).toBe(`wake as cold-reader#00002: lares spirit om cold-reader --mandate ${ARM.w.uri}@${ARM.w.hash} --face 1`);
    const faceless = land({ pet: "cold-reader", instance: "00002", offerer: "hand" });
    expect(S.wakeLine(S.mandateRead(faceless.w.uri, faceless.stored, null))).toBe(`wake as cold-reader#00002: lares spirit om cold-reader --mandate ${faceless.w.uri}@${faceless.w.hash}`);
  });
  test("an unknown launch cap and a flag-shaped model refuse before any launch", () => {
    expect(S.launchHolds(arm)).toBeNull();
    const codex = land({ pet: "cold-reader", instance: "00002", offerer: "hand", "launch-cap": "codex-exec" });
    expect(S.launchHolds(S.mandateRead(codex.w.uri, codex.stored, null))?.code).toBe("launch-cap-unknown");
    const flag = land({ pet: "cold-reader", instance: "00002", offerer: "hand", model: "--dangerously-skip-permissions" });
    expect(S.launchHolds(S.mandateRead(flag.w.uri, flag.stored, null))?.code).toBe("mandate-model-malformed");
  });
});

describe("custody at hand-vs-seat", () => {
  test("a hand summons on a receipt, whatever the mandate grants", () => {
    expect(S.summonsGranted(true, arm, null)).toBeNull();
  });
  test("a seat summons only under a coordinator's mandate that grants summons", () => {
    expect(S.summonsGranted(false, arm, coordinator)).toBeNull();
    expect(S.summonsGranted(false, arm, null)?.code).toBe("summons-ungranted");
    const bare = land({ pet: "lares-alpha", instance: "00001", offerer: "hand", lanes: "2" }, "Coordinate the arms.");
    const r = S.summonsGranted(false, arm, S.mandateRead(bare.w.uri, bare.stored, null))!;
    expect(r.code).toBe("summons-ungranted");
    expect(r.message).toContain("--grants summons");
  });
  test("a parent holding another instance than the offerer named refuses", () => {
    const other = land({ pet: "lares-alpha", instance: "00009", offerer: "hand", grants: "summons", lanes: "2" });
    expect(S.summonsGranted(false, arm, S.mandateRead(other.w.uri, other.stored, null))?.code).toBe("summons-ungranted");
  });
});

describe("the coordinator's lane ceiling", () => {
  const own = S.summonsOf(ARM.w.hash);
  test("a summons under the ceiling passes; its own edge never counts against it", () => {
    expect(S.lanesHold(coordinator, [], own)).toBeNull();
    expect(S.lanesHold(coordinator, [`${M}summons/aaaa`, own], own)).toBeNull();
  });
  test("a summons past the ceiling refuses coordinator-lanes-full, and the cure names the hand-back", () => {
    const r = S.lanesHold(coordinator, [`${M}summons/aaaa`, `${M}summons/bbbb`], own)!;
    expect(r.code).toBe("coordinator-lanes-full");
    expect(r.message).toContain("2 of 2");
    expect(r.message).toContain("lares spirit handback");
  });
  test("a mandate naming no lanes reads zero, never unlimited", () => {
    const r = S.lanesHold(arm, [], own)!;
    expect(r.code).toBe("coordinator-lanes-full");
    expect(r.message).toContain("--lanes <n>");
  });
  test("the open-lanes filter reads the coordinator's edges that hold no hand-back", () => {
    expect(S.openLanesFilter("lares-alpha#00001")).toBe("[tag[summons]field:offerer[lares-alpha#00001]!has[handback]]");
  });
});

describe("the edge the house keeps", () => {
  test("it names the offerer, the instance, the mandate's hash and the face, its parent the mandate", () => {
    const e = S.edgeWrite(arm);
    expect(e.uri).toBe(S.summonsOf(ARM.w.hash));
    expect(e.fields).toMatchObject({ tags: "summons", offerer: "lares-alpha#00001", instance: "cold-reader#00002", "mandate-hash": ARM.w.hash, face: "1", parent: `${ARM.w.uri}@${ARM.w.hash}` });
    expect(e.fields["launched"]).toBeUndefined();
    expect(S.edgeRead(e.uri, e.fields)).toMatchObject({ launched: null, handback: null, instance: "cold-reader#00002" });
    expect(S.edgeRead(e.uri, {})).toBeNull();
  });
});

describe("the wake under a mandate", () => {
  test("it leads with the ref, the seed's read, each affordance as its one command under the mandate's face, and the hand-back", () => {
    const text = S.mandateWakeLines(arm);
    expect(text).toContain(`mandate: ${ARM.w.uri}@${ARM.w.hash} · you wake as cold-reader#00002, offered by lares-alpha#00001 · face h1 · model claude-fable-5-2`);
    expect(text).toContain("lares tiddler get 'lar:///ha.ka.ba/lares/api/noosphere-boot' --recipe default --face 1 --meme --all");
    expect(text).toContain("reads: lares wiki filter '[tag[ruling]]' --recipe default --face 1 --collapse --fields title,description");
    expect(text).toContain(`link: lares tiddler get '${M}state/handoff' --recipe default --face 1 --meme --skinny`);
    expect(text).toContain("paths: packages/lares-cli");
    expect(text).toContain("hand back (three findings, one line each)");
    expect(text).toContain("lares spirit handback 'cold-reader#00002' --record <uri> --face 1");
    expect(text.endsWith(WORDS)).toBe(true);
  });
});

describe("every refusal names its cure and carries no copula", () => {
  test("each message leads with its code, holds a backticked command, and no form of the copula", () => {
    const bare = land({ pet: "lares-alpha", instance: "00001", offerer: "hand" });
    const all = [
      refusal(() => S.mandateRead(ARM.w.uri, {}, null)),
      refusal(() => S.mandateRead(ARM.w.uri, { ...ARM.stored, text: "x" }, null)),
      refusal(() => S.mandateRead(ARM.w.uri, ARM.stored, "0".repeat(64))),
      S.mandateNames(arm, "other", null)!, S.mandateFaceTurned(arm, 2, "lares spirit summon x")!,
      S.summonsGranted(false, arm, null)!, S.summonsGranted(false, arm, S.mandateRead(bare.w.uri, bare.stored, null))!,
      S.lanesHold(coordinator, ["a", "b"], "c")!, S.lanesHold(arm, [], "c")!,
    ];
    for (const r of all) {
      expect(r.message.startsWith(`${r.code}: `), r.code).toBe(true);
      expect(r.message, r.code).toMatch(/`[^`]*lares [^`]+`/);
      expect(r.message, r.code).not.toMatch(/\b(is|are|was|were|be|been|being|am)\b/);
    }
  });
});
