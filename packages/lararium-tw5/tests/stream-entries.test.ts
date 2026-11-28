/**
 * stream-entries — the log graph's law, read with no wiki booted: a stream's root and entry titles, the note's one line, the
 * heads (no clock), and the inbox (seen by direct naming in `re`, entity and instance both).
 *
 * Meme: lar:///ha.ka.ba/lares/afford/engine.msg.lands
 */
import { describe, test, expect } from "vitest";
import { NOTE_MAX, STREAM_STAGE, addressedTo, entryOf, entryTitleOf, headsOf, inboxOf, isAddress, noteFault, readStream, slugOf, streamRootOf, type StreamEntry } from "../src/stream-entries.js";
import { birthHashOf } from "../src/msg-verbs.js";

const entry = (title: string, stream: string, more: Partial<Omit<StreamEntry, "title" | "stream">> = {}): StreamEntry =>
  ({ title, stream, prev: more.prev ?? null, re: more.re ?? [], to: more.to ?? null });

describe("a stream's titles", () => {
  test("a stream name reads <pet>#<n>; its root and entries hold the seed's four path segments and a two-segment stage path", () => {
    expect(readStream("lares-alpha#00003")).toEqual({ pet: "lares-alpha", n: "00003" });
    for (const bad of ["lares-alpha", "Lares#1", "skein#", "#1", "skein 1", "skein#1#2"]) expect(readStream(bad), bad).toBeNull();
    expect(streamRootOf("lares-alpha#00003")).toBe(`${STREAM_STAGE}lares-alpha-00003`);
    expect(entryTitleOf("skein#1", "0a1b2c3d", "built")).toBe(`${STREAM_STAGE}skein-1-0a1b2c3d-built`);
    const path = entryTitleOf("skein#1", "0a1b2c3d", "built").replace("lar:///ha.ka.ba/", "").split("/");
    expect(path).toHaveLength(4);
    expect(entryTitleOf("skein#1", "0a1b2c3d", "built")).not.toContain("#");
  });

  test("a slug takes the first words, lowercase and hyphen-joined, and never stands empty", () => {
    expect(slugOf("Decided: library.oracle.speaks!")).toBe("decided-library-oracle-speaks");
    expect(slugOf("one two three four five six seven")).toBe("one-two-three-four-five-six");
    expect(slugOf("—")).toBe("msg");
    expect(slugOf("a".repeat(80))).toBe("msg");
  });

  test("the birth hash reads the birth fields alone: the same birth, the same h8; a changed note, another", () => {
    const birth = { stream: "skein#1", prev: null, re: [] as string[], to: null, about: null, note: "built" };
    expect(birthHashOf(birth)).toMatch(/^[0-9a-f]{8}$/);
    expect(birthHashOf({ ...birth })).toBe(birthHashOf(birth));
    expect(birthHashOf({ ...birth, note: "built again" })).not.toBe(birthHashOf(birth));
    expect(birthHashOf({ ...birth, re: ["x"] })).not.toBe(birthHashOf(birth));
  });

  test("a note holds one line of 72 characters or fewer, never blank", () => {
    expect(NOTE_MAX).toBe(72);
    expect(noteFault("a".repeat(72))).toBeNull();
    expect(noteFault("a".repeat(73))).toBe("note-too-long");
    expect(noteFault("two\nlines")).toBe("note-one-line");
    expect(noteFault("  ")).toBe("note-needed");
  });

  test("an address names an entity or one instance", () => {
    for (const ok of ["lares-alpha", "lares-alpha#00003", "skein#1"]) expect(isAddress(ok), ok).toBe(true);
    for (const bad of ["Lares Alpha", "lares-alpha#", "a#b#c", ""]) expect(isAddress(bad), bad).toBe(false);
  });
});

describe("the log graph", () => {
  test("an entry carries a stream and a note; a stream's root carries no note and reads as no entry", () => {
    expect(entryOf("t", { stream: "skein#1", note: "n", prev: "p", re: "a [[b c]]", to: "lares-alpha" })).toEqual({ title: "t", stream: "skein#1", prev: "p", re: ["a", "b c"], to: "lares-alpha" });
    expect(entryOf("root", { stream: "skein#1", seat: "claude-code" })).toBeNull();
    expect(entryOf("plain", { text: "no stream" })).toBeNull();
  });

  test("RED: heads read the entries no entry of their own stream names as prev; a fork shows two, and another stream's prev names nothing", () => {
    const all = [
      entry("a", "s#1"), entry("b", "s#1", { prev: "a" }), entry("c", "s#1", { prev: "a" }),
      entry("x", "t#1", { prev: "b" }),
    ];
    expect(headsOf(all, all, "s#1")).toEqual(["b", "c"]);
    expect(headsOf(all, all)).toEqual(["b", "c", "x"]);
    expect(headsOf(all.slice(0, 1), all, "s#1")).toEqual([]);
  });

  test("RED: the inbox reads entries addressed to the reader that no entry the reader writes names directly in re", () => {
    const x = entry("x", "skein#1", { to: "lares-alpha#3" });
    const y = entry("y", "skein#1", { to: "lares-alpha" });
    const z = entry("z", "skein#1", { to: "tern#1" });
    const reply = entry("r", "lares-alpha#3", { re: ["x"] });
    const indirect = entry("i", "lares-alpha#3", { re: ["r"] });
    expect(inboxOf([x, y, z], [x, y, z], "lares-alpha#3")).toEqual(["x", "y"]);
    expect(inboxOf([x, y, z, reply], [x, y, z, reply], "lares-alpha#3")).toEqual(["y"]);
    // An entity reads every instance's address, and any instance's reply reads seen for it.
    expect(inboxOf([x, y, z, reply], [x, y, z, reply], "lares-alpha")).toEqual(["y"]);
    // A sibling instance reads the entity's msg; another instance's reply never reads seen for it.
    expect(inboxOf([x, y, reply], [x, y, reply], "lares-alpha#4")).toEqual(["y"]);
    // Seen reads direct naming alone, never a walk: a reply to the reply leaves y unseen.
    expect(inboxOf([y, indirect], [y, indirect, reply], "lares-alpha#3")).toEqual(["y"]);
    expect(addressedTo(null, "lares-alpha#3")).toBe(false);
  });
});
