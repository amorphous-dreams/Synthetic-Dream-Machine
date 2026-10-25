import { describe, expect, it } from "vitest";
import { carrierTable, CUSTODY_PARTS, type CarrierRow, type CustodyPart } from "../src/vault-carriers.js";

/**
 * The K15 step-zero node census, held as data: every row the spec's table names (`docs/pono/k15-custody-step-zero`
 * #/row-census-node), in its order, beside the classes it sorts into and whether the spec marks it LEAD. A row the
 * spec adds or drops moves this list in the same commit.
 */
const SPEC: ReadonlyArray<readonly [row: string, classes: readonly CustodyPart[], lead: boolean]> = [
  ["vessel-key", ["S"], true], ["vessel-kel", ["F"], false], ["s-slots", ["D", "S"], true], ["sk-slots", ["S"], true], ["fk-slots", ["D"], false], ["face-index", ["F"], false],
  ["vessel-card", ["F"], false], ["charter", ["F"], false], ["carried-charter", ["F"], false],
  ["carriage-consent", ["F"], false], ["nexus-key-line", ["F"], false], ["carriage-admit", ["F"], false],
  ["sealed-rest", ["F"], false], ["sealed-own", ["F"], true], ["sealed-chunk", ["F"], false],
  ["gate-root", ["D"], true], ["place-archive", ["D"], true], ["veil-archive", ["D"], true], ["face-atom", ["D"], false], ["face-anchor", ["D"], false], ["face-atom-ask", ["D"], false], ["face-owner", ["D"], false],
  ["enroll-pending", ["D"], true], ["grant-pending", ["D"], true], ["admissions", ["D"], true],
  ["anchors", ["D"], false], ["persona-roster", ["D"], false],
  ["persona-petnames", ["D"], false], ["persona-declarations", ["D"], false],
  ["public-handles", ["D"], false], ["vessel-face-key", ["D"], false], ["face-address-secret", ["D"], false],
  ["fleet-join-pending", ["D"], false], ["face-join-record", ["D"], false], ["handle-book", ["D"], false],
  ["guardian-set", ["D"], false], ["face-provisional", ["D"], false], ["hosting-state", ["D"], false],
  ["hosting-spent", ["D"], false], ["hosting-carry", ["D"], false], ["walk", ["D"], false],
  ["gate-memory", ["D"], false], ["transition-pending", ["F"], false], ["transitions", ["F"], false],
  ["cofound", ["D"], false], ["outbox-key", ["D"], false], ["sealed-outbox", ["D"], false],
  ["persona-root", ["D"], false], ["face-proof-key", ["D"], false], ["seat-key", ["D"], false],
  ["cadence-key", ["D"], false], ["restore-pending", ["D"], false], ["device-share", ["D"], false],
];

/** The spec's node S candidates: the only rows that may carry an S part. */
const S_ROWS = new Set(["vessel-key", "s-slots", "sk-slots"]);
const JOINTS = new Set(["place-signer", "archive-row-selector"]);

/** Every refusal the census law reads off a table, named; an empty list reads green. */
function refusals(table: readonly CarrierRow[], spec = SPEC): string[] {
  const out: string[] = [];
  for (const r of table) {
    const t = r.target as CarrierRow["target"] | undefined;
    if (t === undefined || t === null) { out.push(`${r.row}: declares no target`); continue; }
    if (t.classes.length === 0) out.push(`${r.row}: empty classes`);
    for (const c of t.classes) if (!CUSTODY_PARTS.includes(c)) out.push(`${r.row}: unknown class ${String(c)}`);
    if (new Set(t.classes).size !== t.classes.length) out.push(`${r.row}: repeats a class`);
    if (t.classes.includes("S")) {
      if (!S_ROWS.has(r.row)) out.push(`${r.row}: S on a row the spec does not name`);
      if (!t.lead && t.joint === null) out.push(`${r.row}: S row neither LEAD nor joint`);
    }
    if (t.joint !== null && !JOINTS.has(t.joint)) out.push(`${r.row}: unknown joint ${t.joint}`);
    if (["hot", "cold", "outbox", "face-hot", "face-cold"].includes(r.custody) && !t.classes.includes("D")) out.push(`${r.row}: ${r.custody} row without a D part`);
    if (r.custody === "floor-plain" && !t.classes.includes("F")) out.push(`${r.row}: floor-plain row without an F part`);
  }
  const names = table.map((r) => r.row);
  for (const [row] of spec) if (!names.includes(row)) out.push(`${row}: spec row missing from the table`);
  for (const n of names) if (!spec.some(([row]) => row === n)) out.push(`${n}: table row the spec does not name`);
  for (const [row, classes, lead] of spec) {
    const r = table.find((x) => x.row === row);
    if (r?.target === undefined) continue;
    if (JSON.stringify(r.target.classes) !== JSON.stringify(classes)) out.push(`${row}: classes ${r.target.classes.join("/")} against the spec's ${classes.join("/")}`);
    if (r.target.lead !== lead) out.push(`${row}: lead ${r.target.lead} against the spec's ${lead}`);
  }
  return out;
}

describe("the node custody census (K15 step zero)", () => {
  const table = carrierTable();

  it("sorts every table row exactly as the spec's census sorts it", () => {
    expect(refusals(table)).toEqual([]);
    expect(table.map((r) => r.row)).toEqual(SPEC.map(([row]) => row));
  });

  it("carries S only on vessel-key, s-slots and sk-slots", () => {
    expect(table.filter((r) => r.target.classes.includes("S")).map((r) => r.row)).toEqual([...S_ROWS]);
  });

  it("gives every hot, cold and outbox row a D part", () => {
    const sealed = table.filter((r) => ["hot", "cold", "outbox", "face-hot", "face-cold"].includes(r.custody));
    expect(sealed.length).toBeGreaterThan(20);
    for (const r of sealed) expect(r.target.classes).toContain("D");
  });

  it("names the two open joints on the rows that wait on them", () => {
    const joints = Object.fromEntries(table.filter((r) => r.target.joint !== null).map((r) => [r.row, r.target.joint]));
    expect(joints).toEqual({
      "vessel-key": "place-signer", "s-slots": "place-signer",
      "place-archive": "archive-row-selector", "veil-archive": "archive-row-selector",
    });
  });

  // CONTROLS: the scan reads a table red when the law breaks, so a green table above proves something.
  describe("controls", () => {
    const strip = (name: string): CarrierRow[] => table.map((r) => (r.row === name ? ({ ...r, target: undefined } as unknown as CarrierRow) : r));
    const retarget = (name: string, target: CarrierRow["target"]): CarrierRow[] => table.map((r) => (r.row === name ? { ...r, target } : r));

    it("refuses a row with no target", () => {
      expect(refusals(strip("walk"))).toContain("walk: declares no target");
    });
    it("refuses an empty classes list", () => {
      expect(refusals(retarget("walk", { classes: [], lead: true, joint: null }))).toContain("walk: empty classes");
    });
    it("refuses an S row the spec does not name", () => {
      expect(refusals(retarget("gate-root", { classes: ["S"], lead: true, joint: null }))).toContain("gate-root: S on a row the spec does not name");
    });
    it("refuses an S row that is neither LEAD nor joint", () => {
      expect(refusals(retarget("sk-slots", { classes: ["S"], lead: false, joint: null }))).toContain("sk-slots: S row neither LEAD nor joint");
    });
    it("refuses a hot row that falls to F", () => {
      expect(refusals(retarget("anchors", { classes: ["F"], lead: false, joint: null }))).toContain("anchors: face-hot row without a D part");
    });
    it("refuses a table missing a spec row and one adding a row", () => {
      expect(refusals(table.filter((r) => r.row !== "device-share"))).toContain("device-share: spec row missing from the table");
      expect(refusals(table, SPEC.filter(([row]) => row !== "device-share"))).toContain("device-share: table row the spec does not name");
    });
  });
});
