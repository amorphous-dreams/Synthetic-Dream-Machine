/**
 * share-config — who may read and write a bag, in ONE place: TW5-native rows over face pet-names, one resolver, the file wins.
 *
 *   SC1 — a filter reads as a title list: bare names, [[bracketed]] names, `*`; any filter operator refuses by name
 *   SC2 — the one resolver: vessel-tier reads for every face with no row; a custom bag with no row stays its owner's; a row
 *         reads and writes for the faces it names (the owner always, a writer reads), and a name matching no face waits named
 *   SC3 — the grants a row owes: owner -> each other face it names, `edit` for a writer; a vessel-tier bag owes none
 *   SC4 — the opaque flag names no face, no bag and no access
 *   SC5 — share.tid round-trips, a person's hand edit reads, a torn record refuses by its place
 *   SC6 — the boot's reconcile: the file wins (puts what differs, removes what it no longer names); no file, nothing moves
 *
 * Written beside the cure (written, unrun here; CI runs it).
 */
import { describe, expect, test } from "vitest";
import {
  ShareConfigRefusal, owedGrants, parseShareFile, parseShareFilter, reconcileShareRows, resolveShare, serializeShareFile,
  shareRowBag, shareRowOf, shareRowFields, sharePendingTitle, SHARE_PENDING_PREFIX, type ShareFace, type ShareRow,
} from "../src/share-config.js";
import { bagUri } from "../src/lar-uris.js";

const FACES: ShareFace[] = [
  { handleIndex: 0, petname: "joshua-fontany" },
  { handleIndex: 1, petname: "joshua-fontany-engineer" },
  { handleIndex: 2, petname: "joshua fontany referee" },
];

describe("the share config", () => {
  test("SC1 — a filter reads as a title list; a filter operator refuses", () => {
    expect(parseShareFilter("joshua-fontany [[joshua fontany referee]]")).toEqual({ all: false, names: ["joshua-fontany", "joshua fontany referee"] });
    expect(parseShareFilter(" * ")).toEqual({ all: true, names: [] });
    expect(parseShareFilter("")).toEqual({ all: false, names: [] });
    for (const bad of ["[tag[x]]", "a +b", "[[open", "-x"]) expect(() => parseShareFilter(bad)).toThrow(ShareConfigRefusal);
  });

  test("SC2 — the one resolver", () => {
    const garden = bagUri("garden"), notes = bagUri("notes"), sdm = bagUri("sdm");
    expect(resolveShare({ bag: sdm, rows: [], faces: FACES, vesselTier: true })).toMatchObject({ read: [0, 1, 2], write: [0, 1, 2], source: "vessel-tier" });
    expect(resolveShare({ bag: garden, rows: [], faces: FACES, owner: 1 })).toMatchObject({ read: [1], write: [1], source: "private" });
    const rows: ShareRow[] = [{ slug: "notes", kind: "bag", read: "[[joshua fontany referee]] nobody-here", write: "joshua-fontany" }];
    const answer = resolveShare({ bag: notes, rows, faces: FACES, owner: 1 });
    expect(answer).toMatchObject({ read: [0, 1, 2], write: [0, 1], waiting: ["nobody-here"], source: "row" });
    expect(shareRowBag(rows[0]!)).toBe(notes);
  });

  test("SC3 — the grants a row owes; vessel tier owes none", () => {
    const rows: ShareRow[] = [
      { slug: "notes", kind: "bag", read: "[[joshua fontany referee]]", write: "joshua-fontany" },
      { slug: "sdm", kind: "bag", read: "*", write: "" },
    ];
    const grants = owedGrants({ rows, faces: FACES, ownerOf: (b) => (b === bagUri("notes") ? 1 : 0), vesselTier: (b) => b === bagUri("sdm") });
    expect(grants).toEqual([
      { bag: bagUri("notes"), owner: 1, grantee: 0, access: "edit" },
      { bag: bagUri("notes"), owner: 1, grantee: 2, access: "read" },
    ]);
  });

  test("SC4 — the pending flag names nothing", () => {
    const title = sharePendingTitle({ bag: bagUri("notes"), owner: 1, grantee: 2, access: "read" }, "vessel-salt");
    expect(title.startsWith(SHARE_PENDING_PREFIX)).toBe(true);
    expect(title).not.toMatch(/notes|referee|read/);
    expect(sharePendingTitle({ bag: bagUri("notes"), owner: 1, grantee: 2, access: "read" }, "another-vessel")).not.toBe(title);
  });

  test("SC5 — the file round-trips and reads a hand's edit; a torn record refuses", () => {
    const rows: ShareRow[] = [
      { slug: "notes", kind: "bag", read: "[[joshua fontany referee]]", write: "joshua-fontany", note: "the referee reads the notes" },
      { slug: "garden", kind: "wiki", read: "*", write: "" },
    ];
    const text = serializeShareFile(rows);
    expect(parseShareFile(text)).toEqual([...rows].sort((a, b) => (a.slug < b.slug ? -1 : 1)));
    const edited = text.replace("write: joshua-fontany", "write: joshua-fontany joshua-fontany-engineer");
    expect(parseShareFile(edited).find((r) => r.slug === "notes")!.write).toBe("joshua-fontany joshua-fontany-engineer");
    expect(() => parseShareFile("title: not-a-share-row\n\n")).toThrow(/share-file-malformed: record 1/);
    expect(shareRowOf(shareRowFields(rows[0]!))).toEqual(rows[0]);
  });

  test("SC6 — the file wins at boot; with no file nothing moves", () => {
    const control: ShareRow[] = [{ slug: "notes", kind: "bag", read: "a", write: "" }, { slug: "old", kind: "bag", read: "*", write: "" }];
    const file: ShareRow[] = [{ slug: "notes", kind: "bag", read: "a b", write: "" }, { slug: "new", kind: "bag", read: "*", write: "" }];
    const r = reconcileShareRows(file, control);
    expect(r.put.map((x) => x.slug).sort()).toEqual(["new", "notes"]);
    expect(r.remove).toEqual(["$:/config/lares/share/old"]);
    expect(reconcileShareRows(null, control)).toEqual({ put: [], remove: [] });
  });
});
