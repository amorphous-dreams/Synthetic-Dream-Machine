/**
 * control-home — the vessel's CONTROL document: one document, named by the daemon document, minted at its first stand,
 * held as its own store and never as a recipe layer; it seals under the lit face beside the daemon wiki's slots.
 */
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import {
  CONTROL_HOME_ID, DAEMON_BAG_ID, MAILBOX_URI_PREFIX, OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX, SUMMONS_URI_PREFIX, WARD_AUDIT_URI_PREFIX, EFFECT_URI_PREFIX,
  controlHomeUrlOf, controlStoreOf, emptyLarDoc, expandRecipe, leaseEpochPrefix, standControlHome, wornFaceWikiBags, type LarDoc,
} from "../src/index.js";

describe("the vessel's control document", () => {
  test("RED: the first stand mints one control document and names it in the daemon document; CONTROL: a second stand returns that same document", async () => {
    const repo = new Repo({});
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    expect(controlHomeUrlOf(daemon.doc())).toBeNull();
    const first = await standControlHome(repo, daemon);
    expect(controlHomeUrlOf(daemon.doc())).toBe(first.url);
    const second = await standControlHome(repo, daemon);
    expect(second.documentId).toBe(first.documentId);
    expect(first.documentId).not.toBe(daemon.documentId);
  });

  test("the control store writes its one layer by default, and that layer names the control home", async () => {
    const repo = new Repo({});
    const control = controlStoreOf(repo.create<LarDoc>(emptyLarDoc()));
    expect(control.defaultWritableBagId()).toBe(CONTROL_HOME_ID);
    await control.put({ tiddler: { title: `${OUTCOME_URI_PREFIX}r1`, status: "done" } }, { kind: "test" });
    expect(await control.listBagsHolding(`${OUTCOME_URI_PREFIX}r1`)).toEqual([CONTROL_HOME_ID]);
  });

  test("every control family titles under the control home, never the daemon bag", () => {
    for (const prefix of [SUMMONS_URI_PREFIX, OUTCOME_URI_PREFIX, RECEIPT_FACT_URI_PREFIX, WARD_AUDIT_URI_PREFIX, MAILBOX_URI_PREFIX, EFFECT_URI_PREFIX, leaseEpochPrefix("group")]) {
      expect(prefix.startsWith(`${CONTROL_HOME_ID}/`), prefix).toBe(true);
      expect(prefix.startsWith(`${DAEMON_BAG_ID}/`), prefix).toBe(false);
    }
  });

  test("no recipe composes the control home", () => {
    expect(expandRecipe({ wikiSlug: "daemon" })).not.toContain(CONTROL_HOME_ID);
  });

  test("RED: the control home seals and registers under a lit face; CONTROL: at the floor it neither seals nor registers", () => {
    const lit = wornFaceWikiBags({ lit: true });
    expect(lit.sealed).toContain(CONTROL_HOME_ID);
    expect(lit.registered).toContain(CONTROL_HOME_ID);
    const floor = wornFaceWikiBags({ lit: false });
    expect(floor.sealed).not.toContain(CONTROL_HOME_ID);
    expect(floor.registered).not.toContain(CONTROL_HOME_ID);
  });
});
