/**
 * meme-normalize — slot-name orthography (operator ruling, slot-grammar-orthography).
 *
 * A slot token admits Hawaiian orthography — `[a-z0-9āēīōūʻ-]` — while sigil HEADS stay core
 * ASCII. Normalize folds INSIDE SLOT NAMES ONLY, fence-masked: NFC first (a decomposed vowel +
 * combining macron precomposes), then folds ʻokina look-alikes (the curly quotes and the typable
 * straight apostrophe) to the one ʻokina glyph U+02BB. Each fold reports through `flags`.
 */

import { describe, test, expect } from "vitest";
import { normalizeMemeSource } from "../src/meme-normalize.js";
import { CARRIER_DECLARATION as DECLARATION } from "@lararium/memetic-frame";

const SLOT_HEAD = (body: string) =>
  `${DECLARATION}\n\n<<^ code="&#x0001;" from=? -> to=lar:///x>>\n` +
  "```toml meta\n" +
  `cacheable = true\n` +
  "```\n\n<<^ code=\"&#x0002;\">>\n\n" + body + "\n\n" +
  "<<^ code=\"&#x0003;\">>\n";

describe("normalizeMemeSource — slot-name orthography", () => {
  test("a straight apostrophe folds to ʻokina with a flag", () => {
    const r = normalizeMemeSource(SLOT_HEAD("<<~ ahu #/hawai'i>>\n\nbody\n\n<<~/ahu>>"));
    expect(r.text).toContain("<<~ ahu #/hawaiʻi>>");
    expect(r.flags.join()).toMatch(/slot name:.*folded/);
  });

  test("a curly right-quote look-alike folds to ʻokina with a flag", () => {
    const r = normalizeMemeSource(SLOT_HEAD("<<~ ahu #/hawai’i>>\n\nbody\n\n<<~/ahu>>"));
    expect(r.text).toContain("<<~ ahu #/hawaiʻi>>");
    expect(r.flags.join()).toMatch(/slot name:.*folded/);
  });

  test("a curly left-quote look-alike folds to ʻokina with a flag", () => {
    const r = normalizeMemeSource(SLOT_HEAD("<<~ ahu #/hawai‘i>>\n\nbody\n\n<<~/ahu>>"));
    expect(r.text).toContain("<<~ ahu #/hawaiʻi>>");
  });

  test("a decomposed vowel (a + combining macron) precomposes to ā", () => {
    const decomposed = "kānāwai".normalize("NFD"); // a+macron, decomposed
    const r = normalizeMemeSource(SLOT_HEAD(`<<~ ahu #/${decomposed}>>\n\nbody\n\n<<~/ahu>>`));
    expect(r.text).toContain("<<~ ahu #/kānāwai>>");
  });

  test("an already-canonical ʻokina slot round-trips byte-unchanged", () => {
    const src = SLOT_HEAD("<<~ ahu #/hawaiʻi>>\n\nbody\n\n<<~/ahu>>");
    const r = normalizeMemeSource(src);
    expect(r.changed).toBe(false);
    expect(r.text).toBe(src);
  });

  test("an already-canonical kahakō slot (#/kānāwai) round-trips byte-unchanged", () => {
    const src = SLOT_HEAD("<<~ ahu #/kānāwai>>\n\nbody\n\n<<~/ahu>>");
    const r = normalizeMemeSource(src);
    expect(r.changed).toBe(false);
    expect(r.text).toBe(src);
  });

  test("an ASCII-only slot carrier is byte-unchanged by this clause", () => {
    const src = SLOT_HEAD("<<~ ahu #/plain-slot>>\n\nbody\n\n<<~/ahu>>");
    const r = normalizeMemeSource(src);
    expect(r.changed).toBe(false);
    expect(r.text).toBe(src);
  });

  test("a fenced example of an apostrophe'd slot stays as authored", () => {
    const r = normalizeMemeSource(SLOT_HEAD("```\n<<~ ahu #/hawai'i>>\n```"));
    expect(r.text).toContain("<<~ ahu #/hawai'i>>");
    expect(r.text).not.toContain("ʻ");
  });

  test("idempotent — folding twice converges", () => {
    const once = normalizeMemeSource(SLOT_HEAD("<<~ ahu #/hawai'i>>\n\nbody\n\n<<~/ahu>>"));
    const twice = normalizeMemeSource(once.text);
    expect(twice.changed).toBe(false);
    expect(twice.text).toBe(once.text);
  });
});
