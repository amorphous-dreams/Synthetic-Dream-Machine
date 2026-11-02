/**
 * META PARITY — the frame's read of the sealed root meta and the house's read of it name one carrier.
 *
 * Three laws, each over the whole corpus with a planted known positive (blind security read A1 · A3):
 *   · ONE FENCE: the fence the frame binds the head against (`rootMetaFence`) is byte for byte the fence
 *     the deserializer splits the root fields from (its division's `bodyMeta`).
 *   · ONE READING: the frame's binding keys equal smol-toml's root keys over that fence (`metaParityFaults`),
 *     and `memeticVerdict` tears where they part.
 *   · THE READER'S PROBES tear through the house door too.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { frameCarrier, rootMetaFence, META_OPEN_CANON } from "@lararium/memetic-frame";
import { carrierFiles } from "../src/carrier-files.js";
import { deserializeCarrier } from "../src/deserializer.js";
import { memeticVerdict, metaParityFaults } from "../src/meta-parity.js";
import { REPO } from "./test-wiki.js";

const URI = "lar:///ha.ka.ba/t/parity";
const meta = (...lines: string[]): string => `${META_OPEN_CANON}\n${lines.join("\n")}\n\`\`\`\n\nProse.`;
const sealed = (body: string): string => frameCarrier({ head: { uri: URI }, body });

describe("★ one fence, one reading: the frame and the house read one sealed meta ★", () => {
  const files = carrierFiles(REPO);

  test("the corpus reaches past 780 carriers (no silent zero)", () => {
    expect(files.length).toBeGreaterThan(780);
  });

  test("★ ONE FENCE: every carrier's frame root fence is the deserializer's root fence, byte for byte ★", () => {
    const split: string[] = [];
    for (const f of files) {
      const text = readFileSync(join(REPO, f), "utf8");
      const frame = rootMetaFence(text)?.body ?? null;
      const deser = deserializeCarrier(text, { title: "lar:///x" }).read?.division.bodyMeta?.content ?? null;
      if (frame !== deser) split.push(f);
    }
    expect(split).toEqual([]);
  }, 60_000);

  test("★ ONE READING: no carrier's frame keys part from smol-toml's ★", () => {
    const parted = files.filter((f) => metaParityFaults(readFileSync(join(REPO, f), "utf8")).length > 0);
    expect(parted).toEqual([]);
  }, 60_000);

  test("KNOWN POSITIVE: a meta the frame binds and TOML refuses tears through the house door", () => {
    const text = sealed(meta(`title = "${URI}"`, "mana = 1", "mana = 2"));
    expect(metaParityFaults(text).map((f) => f.kind)).toEqual(["head-meta-split"]);
    const v = memeticVerdict(text);
    expect(v.kind === "torn" && v.faults.map((f) => f.kind)).toEqual(["head-meta-split"]);
  });

  test("CONTROL: a clean sealed meta reads match through the house door", () => {
    expect(memeticVerdict(sealed(meta(`title = "${URI}"`, 'uri-path = "ha.ka.ba/t/parity"', "mana = 16"))).kind).toBe("match");
  });

  test.each([
    ["a comment holding a triple quote", ['# """', 'title="lar:///evil"', "[t]", '# """', `title="${URI}"`]],
    ["a byte-order mark mid-body", ['﻿title = "lar:///evil"', 'uri-path="ha.ka.ba/t/parity"']],
  ])("the reader's probe through the house door: %s tears", (_n, lines) => {
    expect(memeticVerdict(sealed(meta(...lines))).kind).toBe("torn");
  });
});
