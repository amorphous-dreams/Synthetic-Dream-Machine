/**
 * A destination no plane reaches refuses with each plane's reason. The daemon reaches a deep bag by access across
 * the catalog and oracle planes; a plane whose document never arrived, or was reported unavailable, names that in
 * the refusal, so a timeout never reads as an unregistered bag. A bag every plane answers for with no store reads
 * as unregistered, with no plane reason beside it.
 */
import { describe, test, expect } from "vitest";
import { CompositeStore } from "@lararium/mesh";
import type { Repo, DocHandle, LarDoc, Verb } from "@lararium/mesh";
import { makeActionReactorFor } from "../src/action-handler.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const CATALOG_URL = "automerge:catalog-doc";
const ORACLE_URL = "automerge:oracle-doc";
const FROM = "lar:///ha.ka.ba/bags/from";
const TO = "lar:///ha.ka.ba/bags/lares";

function repoOf(present: readonly string[]): Repo {
  const doc = { tiddlers: {} } as unknown as LarDoc;
  const handle = (url: string) => ({ url, doc: () => doc, on: () => {}, whenReady: async () => {}, change: (fn: (d: LarDoc) => void) => fn(doc) }) as unknown as DocHandle<LarDoc>;
  return {
    find: async (url: string) => {
      if (!present.includes(url)) throw new Error(`document ${url} is unavailable`);
      return handle(url);
    },
  } as unknown as Repo;
}

function ctx(): VerbContext {
  const invocation = { action: "COPY", args: {}, requestId: "req-plane-cause", requestedBy: "did:key:test" } as unknown as Verb;
  return { daemon: new CompositeStore(), invocation, cap: async () => ({ ok: true }) };
}

async function refusalOf(repo: Repo, to = TO, slotDocUrl?: () => Promise<string | null>): Promise<string> {
  const reactor = makeActionReactorFor("COPY", { composite: new CompositeStore(), reach: { repo, catalogUrl: CATALOG_URL, oracleUrl: ORACLE_URL, ...(slotDocUrl ? { slotDocUrl } : {}) } });
  try {
    await reactor({ title: "T", "from-bag": FROM, "to-bag": to, "change-id": "c1" }, ctx());
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  throw new Error("the reactor did not refuse");
}

describe("a destination no plane reaches", () => {
  test("RED: a plane whose document never arrived names that in the refusal", async () => {
    const message = await refusalOf(repoOf([CATALOG_URL]));
    expect(message).toContain(`destination bag "${TO}" unreachable`);
    expect(message).toContain("The planes answered: oracle: [document-unavailable]");
    expect(message).toContain(ORACLE_URL);
    expect(message).not.toContain("catalog: ");
    expect(message).not.toMatch(/\.\.$/);
  });

  test("RED: a wiki's slot doc that never arrives names that in the refusal too", async () => {
    const working = "lar:///ha.ka.ba/wikis/lares/working";
    const message = await refusalOf(repoOf([CATALOG_URL, ORACLE_URL]), working, async () => "automerge:working-doc");
    expect(message).toContain(`destination bag "${working}" unreachable`);
    expect(message).toContain("The planes answered: slot: [document-unavailable]");
    expect(message).toContain("automerge:working-doc");
  });

  test("CONTROL: a bag both planes answer for with no store reads as unregistered, with no plane reason", async () => {
    const message = await refusalOf(repoOf([CATALOG_URL, ORACLE_URL]));
    expect(message).toContain(`destination bag "${TO}" unreachable`);
    expect(message).not.toContain("The planes answered");
  });
});
