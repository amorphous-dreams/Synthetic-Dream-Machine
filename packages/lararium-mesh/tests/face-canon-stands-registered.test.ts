/**
 * face-canon-stands-registered — a worn face's daemon canon stands only where its bag stands registered and sealed.
 *
 * The canon's document seals under the face, so a save there waits on a bag the face registers. A worn face that stands
 * unlit registers no daemon bag (`wornFaceWikiBags`), so it stands no canon either: `standingDaemonCanonBag` answers the
 * canon's bag under the one condition the register set reads.
 */
import { Repo } from "@automerge/automerge-repo";
import { describe, expect, test } from "vitest";
import { CONTROL_HOME_ID, daemonFaceCanonBag, emptyLarDoc, standFaceDaemonCanon, standingDaemonCanonBag, tiddlerText, wornFaceWikiBags, type LarDoc } from "../src/index.js";

const F = "123e4567-e89b-42d3-a456-426614174000";

describe("the face daemon canon follows its registration", () => {
  test("an unlit worn face stands no canon; a lit one stands the canon its register set seals", () => {
    expect(standingDaemonCanonBag({ lit: false, faceRelation: F })).toBeNull();
    expect(standingDaemonCanonBag({ lit: true, faceRelation: null })).toBeNull();
    const bag = standingDaemonCanonBag({ lit: true, faceRelation: F });
    expect(bag).toBe(daemonFaceCanonBag(F));
    const bags = wornFaceWikiBags({ lit: true, daemonCanon: bag! });
    expect(bags.registered).toContain(bag);
    expect(bags.sealed).toContain(bag);
  });

  test("the canon stands under the registered bag, maps before its first byte, and the control document names it once", async () => {
    const repo = new Repo({ network: [] });
    const control = repo.create<LarDoc>(emptyLarDoc());
    const registered = standingDaemonCanonBag({ lit: true, faceRelation: F })!;
    const mapped: Array<{ bagId: string; documentId: string; held: boolean }> = [];
    const beforeFirstByte = (bagId: string, documentId: string): void => {
      // THE MAP STANDS BEFORE THE DOCUMENT: at this call no handle for the id stands on the Repo yet.
      mapped.push({ bagId, documentId, held: Object.keys(repo.handles).includes(documentId) });
    };
    const first = await standFaceDaemonCanon({ repo, control, faceRelation: F, beforeFirstByte });
    expect(first.bagId).toBe(registered);
    expect(wornFaceWikiBags({ lit: true, daemonCanon: first.bagId }).sealed).toContain(first.bagId);
    expect(mapped).toEqual([{ bagId: registered, documentId: first.handle.documentId, held: false }]);
    const named = tiddlerText(control.doc()?.tiddlers?.[`${CONTROL_HOME_ID}/daemon-canon/${encodeURIComponent(F)}`] as never);
    expect(named).toBe(first.url);
    // A second stand reads the control document's name and stands the same document: one canon per face.
    const second = await standFaceDaemonCanon({ repo, control, faceRelation: F, beforeFirstByte });
    expect(second.url).toBe(first.url);
    expect(mapped[1]).toMatchObject({ bagId: registered, documentId: first.handle.documentId });
  });
});
