/**
 * face-working-slot-founding — THE FACE'S ADDRESS SECRET MINTS AT ITS FOUNDING (Lares's ruling, 2026-10-27): beside its
 * atom, behind its custody, so a fresh founding's face resolves its working slot with no `fleet join offer`; no read mints.
 *
 *   RED      a fresh hearth's face h0 holds its address secret at founding, and its working slot derives from it.
 *   CONTROL  a vessel the face joins lands those same bytes, and resolves the same slot the founder does.
 *
 * Real founding (`runInit`, `runFoundTheFace`) over scratch roots; synthetic names.
 */
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { resolveFaceWorkingSlot } from "@lararium/mesh";
import * as init from "../src/commands/init.js";
import { seatedCustody, unseatCustody } from "../src/custody-seat.js";
import { landFaceAddressSecret, readFaceAddressSecret } from "../src/fleet-join-custody.js";
import { loadIdentityAnchors } from "../src/identity-anchors.js";
import { larDataDir } from "../src/vessel-paths.js";
import { direct } from "./direct-store.js";
import { foundDirect, seatSeedCharter } from "./found-route.js";

vi.setConfig({ testTimeout: 300_000, hookTimeout: 300_000 });

const REPO_GENESIS = join(import.meta.dirname, "..", "..", "..", "genesis");
const foundFace = direct(init.runFoundTheFace);
const roots: string[] = [];
const priorRoot = process.env["LAR_ROOT"];

async function leave(): Promise<void> {
  const holder = seatedCustody();
  if (holder) { await holder.lock(); unseatCustody(holder); }
}
async function standAt(label: string, face: boolean): Promise<void> {
  await leave();
  const root = mkdtempSync(join(tmpdir(), `lar-working-${label}-`));
  roots.push(root);
  process.env["LAR_ROOT"] = root;
  cpSync(REPO_GENESIS, join(root, "genesis"), { recursive: true });
  await foundDirect({ storageDir: larDataDir(), genesisDir: join(root, "genesis") });
  await seatSeedCharter({ name: `${label}-keeper` });
  if (face) await foundFace({ genesisDir: join(root, "genesis"), handleIndex: 0 });
}
afterEach(async () => {
  await leave();
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const slotOf = async (group: string): Promise<string> => {
  const r = await resolveFaceWorkingSlot({ wikiId: "daemon", kind: "working", secret: () => readFaceAddressSecret(group) });
  if (!r.ok) throw r.refusal;
  return r.url;
};

describe("the face's address secret mints at its founding", () => {
  test("RED: a fresh founding's face resolves its working slot with no fleet join offer; CONTROL: a joined vessel resolves the same slot", async () => {
    await standAt("founder", true);
    const group = (await loadIdentityAnchors(0))!.personaGroupId;
    const secret = await readFaceAddressSecret(group);
    expect(secret, "the founding minted the face's address secret beside its atom").not.toBeNull();
    const founded = await slotOf(group);
    expect(await slotOf(group), "a second read derives the same slot and mints nothing").toBe(founded);

    // CONTROL: the vessel a fleet join lands on keeps the bytes its answer carried and derives the founder's slot.
    await standAt("joinee", false);
    expect(await readFaceAddressSecret(group), "nothing stands on the joinee before its landing").toBeNull();
    await landFaceAddressSecret(group, secret!);
    secret!.fill(0);
    expect(await slotOf(group)).toBe(founded);
  });
});
