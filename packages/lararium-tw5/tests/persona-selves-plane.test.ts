/**
 * persona-selves-plane — a human's own-persona names land on the persona plane's store, read back, and touch
 * nothing beside their own self tiddler.
 *
 *   P1  one write moves ONE name's value+stamp pair; the fold reads it back.
 *   P2  the two names carry separate stamps: a Handle write never re-stamps the pet-name.
 *   P3  the fold answers ascending by handle-index.
 *   P4  an empty value clears one name and leaves the other standing.
 *   P5  a stamp the plane already outranks writes nothing and says so.
 *       CONTROL: the same write under a later stamp lands.
 *   P6  only the persona's own self tiddler moves; the identity machinery beside it stays untouched and unread.
 *   P7  a handle-index that names no face refuses; nothing lands.
 *   P8  no move takes a seat claim: the written tiddler carries the two names, their stamps and its title alone.
 */
import { describe, expect, test } from "vitest";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { readPersonaSelves, writePersonaSelfName } from "../src/persona-selves-plane.js";
import { personaSelfTiddlerUri, PERSONA_NAMESPACE, mutableLarRecord } from "@lararium/mesh";

const store = (): MemoryTiddlerStore => new MemoryTiddlerStore(PERSONA_NAMESPACE);
const fieldsOf = async (s: MemoryTiddlerStore, handleIndex: number): Promise<Record<string, unknown>> =>
  ((await s.get(personaSelfTiddlerUri(handleIndex)))?.tiddler ?? {}) as Record<string, unknown>;

describe("the two names on the persona plane", () => {
  test("P1 — one write lands one name and the fold reads it back", async () => {
    const s = store();
    expect(await writePersonaSelfName(s, 1, "petname", "veil-two", "t1")).toEqual({ written: true });
    expect(await readPersonaSelves(s)).toEqual([{ handleIndex: 1, petname: "veil-two" }]);
    await writePersonaSelfName(s, 1, "handle", "Kahu Beta", "t2");
    expect(await readPersonaSelves(s)).toEqual([{ handleIndex: 1, petname: "veil-two", handle: "Kahu Beta" }]);
  });

  test("P2 — a Handle write never re-stamps the pet-name", async () => {
    const s = store();
    await writePersonaSelfName(s, 0, "petname", "veil-one", "t1");
    await writePersonaSelfName(s, 0, "handle", "Kahu Alpha", "t9");
    const fields = await fieldsOf(s, 0);
    expect(fields["petname@"]).toBe("t1");
    expect(fields["handle@"]).toBe("t9");
  });

  test("P3 — the fold answers ascending by handle-index", async () => {
    const s = store();
    for (const i of [4, 0, 2]) await writePersonaSelfName(s, i, "petname", `p${i}`, "t1");
    expect((await readPersonaSelves(s)).map((x) => x.handleIndex)).toEqual([0, 2, 4]);
  });

  test("P4 — an empty value clears one name and leaves the other standing", async () => {
    const s = store();
    await writePersonaSelfName(s, 3, "petname", "burner", "t1");
    await writePersonaSelfName(s, 3, "handle", "Kahu Gamma", "t1");
    expect(await writePersonaSelfName(s, 3, "petname", "", "t2")).toEqual({ written: true });
    expect(await readPersonaSelves(s)).toEqual([{ handleIndex: 3, handle: "Kahu Gamma" }]);
  });

  test("P5 — a stamp the plane outranks writes nothing; a later stamp lands", async () => {
    const s = store();
    await writePersonaSelfName(s, 0, "petname", "the-newer-name", "t5");
    expect(await writePersonaSelfName(s, 0, "petname", "a-stale-name", "t4")).toEqual({ written: false });
    expect(await readPersonaSelves(s)).toEqual([{ handleIndex: 0, petname: "the-newer-name" }]);
    expect(await writePersonaSelfName(s, 0, "petname", "the-newest-name", "t6")).toEqual({ written: true });   // control
    expect(await readPersonaSelves(s)).toEqual([{ handleIndex: 0, petname: "the-newest-name" }]);
  });

  test("P6 — only the persona's own self tiddler moves; the identity machinery stays untouched and unread", async () => {
    const s = store();
    s._seed(mutableLarRecord(`${PERSONA_NAMESPACE}/binding/signer-did`, { text: "0xdead" }, "lararium-seed"));
    await writePersonaSelfName(s, 2, "petname", "veil-three", "t1");
    await writePersonaSelfName(s, 2, "handle", "Kahu Gamma", "t1");
    expect((await s.listVisible()).sort()).toEqual([`${PERSONA_NAMESPACE}/binding/signer-did`, personaSelfTiddlerUri(2)].sort());
    expect(await readPersonaSelves(s)).toEqual([{ handleIndex: 2, petname: "veil-three", handle: "Kahu Gamma" }]);
    expect(((await s.get(`${PERSONA_NAMESPACE}/binding/signer-did`))?.tiddler as { text?: string })?.text).toBe("0xdead");
  });

  test("P7 — a handle-index that names no face refuses and nothing lands", async () => {
    const s = store();
    await expect(writePersonaSelfName(s, -1, "petname", "x", "t1")).rejects.toThrow(/handle-index/);
    await expect(writePersonaSelfName(s, 1.5, "petname", "x", "t1")).rejects.toThrow(/handle-index/);
    expect(await s.listVisible()).toEqual([]);
  });

  test("P8 — the written tiddler carries the two names, their stamps and its title alone", async () => {
    const s = store();
    await writePersonaSelfName(s, 0, "petname", "veil-one", "t1");
    await writePersonaSelfName(s, 0, "handle", "Kahu Alpha", "t1");
    expect(Object.keys(await fieldsOf(s, 0)).sort()).toEqual(["handle", "handle@", "petname", "petname@", "title"]);
  });
});
