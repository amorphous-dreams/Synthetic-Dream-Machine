import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, realmDocPointer, tiddlerText, type NexusDoc } from "@lararium/mesh";
import { namedCharter } from "../../lararium-mesh/tests/charter-fixture.js";
import { makeRealmPlane } from "../src/realm-plane.js";
import { runRealmBags } from "../src/realm-steward.js";

const aid = (name: string): string => `nexus-${createHash("sha256").update(name).digest("hex")}`;
const charter = (name: string): NexusDoc => namedCharter(aid(name));

describe("carried realm planes without a primary charter", () => {
  test("boot and refresh list every carried plane and leave the primary default empty", async () => {
    const repo = new Repo({});
    const registry = repo.create(emptyLarDoc());
    const crossroadsHandle = repo.create(emptyLarDoc());
    let carried = [charter("carried-a"), charter("carried-b")];
    const holder = makeRealmPlane({
      repo, registry, crossroadsHandle,
      membership: { holdsCarriagePeer: () => false },
      base: { mayFederate: async () => false },
      carried: () => carried,
    });
    const first = aid("carried-a"), second = aid("carried-b");
    try {
      await holder.refresh(null);
      expect(holder.realmId()).toBeNull();
      expect(holder.plane(null)).toBeNull();
      expect(holder.realms()).toEqual([first, second].sort());
      expect(holder.plane(first)?.realmId()).toBe(first);
      expect(tiddlerText(registry.doc().tiddlers[realmDocPointer(first)])).toBe(holder.plane(first)?.realmUrl());
      const listed = await runRealmBags({ plane: holder });
      expect(listed.realms).toEqual([first, second].sort());
      expect(listed.realm).toBe([first, second].sort()[0]);

      carried = [charter("carried-b")];
      await holder.refresh(null);
      expect(holder.realms()).toEqual([second]);
      expect(holder.plane(first)).toBeNull();
      expect(registry.doc().tiddlers[realmDocPointer(first)]).toBeUndefined();
    } finally {
      holder.dispose();
    }
  });
});
