/**
 * The store door binds each face row to the face the session wore: main's delegate hands the row the session's ordinal
 * as main booked it (`VerbContext.worn`), and a row naming another face refuses, never acting as that face. A face row
 * that rode no session refuses; a place row needs none.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { storeDoorReactors, STORE_DOOR_FACE_ROWS } from "../src/store-door-verbs.js";

// Every row resolves its homes under a scratch LAR_ROOT, so a row that runs (the parent's leak) writes nowhere real.
const roots: string[] = [];
const priorRoot = process.env["LAR_ROOT"];
afterEach(() => {
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function door() {
  const root = mkdtempSync(join(tmpdir(), "store-door-worn-")); roots.push(root);
  process.env["LAR_ROOT"] = root;
  return storeDoorReactors({ storageDir: join(root, "store"), sealHome: join(root, "seal"), repo: {} as never });
}
const ATOM_1 = `0x${"b1".repeat(32)}`;
const ctxOf = (worn?: { ordinal: number; presenter: string }) => ({
  daemon: {} as never, invocation: { requestId: "r-worn", args: {}, requestedBy: ATOM_1 } as never,
  cap: async () => ({ ok: true }), local: true, ...(worn ? { worn } : {}),
}) as never;
// A realm no cabal-face accepts: the row refuses it by its own words once the binding lets it through.
const BAD_REALM = { realm: "not-a-realm" };

test("RED: a session wearing face 1 that names face 0 refuses face-row-other-face; CONTROL: naming its own face, or none, reaches the row", async () => {
  const rows = door();
  const worn = { ordinal: 1, presenter: ATOM_1 };
  expect(await rows["cabal-face"]({ ...BAD_REALM, face: 0 }, ctxOf(worn))).toMatchObject({ refused: expect.stringMatching(/face-row-other-face/) });
  expect(await rows["raise-sign"]({ challengeText: "x", handleIndex: 0 }, ctxOf(worn))).toMatchObject({ refused: expect.stringMatching(/face-row-other-face/) });
  expect(await rows["cabal-face"]({ ...BAD_REALM, face: 1, handleIndex: 0 }, ctxOf(worn))).toMatchObject({ refused: expect.stringMatching(/face-row-other-face/) });
  // CONTROL: the row's own refusal (a malformed realm) proves the binding admitted the session's face.
  expect(await rows["cabal-face"]({ ...BAD_REALM, face: 1 }, ctxOf(worn))).toMatchObject({ refused: expect.stringMatching(/64-hex/) });
  expect(await rows["cabal-face"]({ ...BAD_REALM }, ctxOf(worn))).toMatchObject({ refused: expect.stringMatching(/64-hex/) });
});

test("RED: a face row that rode no session refuses face-row-rides-a-session, whatever face it names; CONTROL: a place row runs", async () => {
  const rows = door();
  for (const args of [{ ...BAD_REALM }, { ...BAD_REALM, face: 0 }, { ...BAD_REALM, face: 1 }]) {
    expect(await rows["cabal-face"](args, ctxOf())).toMatchObject({ refused: expect.stringMatching(/face-row-rides-a-session/) });
  }
  expect(await rows["seal-home-refold"]({}, ctxOf())).toEqual({ verb: "seal-home-refold", attempted: false, refolded: false });
});

test("every face row takes the binding: none reaches its command under another face's name", async () => {
  const rows = door();
  const worn = { ordinal: 1, presenter: ATOM_1 };
  const leaked: string[] = [];
  expect(STORE_DOOR_FACE_ROWS.size).toBeGreaterThan(20);           // silent-zero guard: the set the sweep reads
  for (const verb of STORE_DOOR_FACE_ROWS) {
    const r = await rows[verb]({ face: 0 }, ctxOf(worn)).catch((e: Error) => ({ threw: e.message }));
    if (!/face-row-other-face/.test(String((r as { refused?: string }).refused ?? ""))) leaked.push(`${verb}: ${JSON.stringify(r).slice(0, 120)}`);
  }
  expect(leaked).toEqual([]);
});
