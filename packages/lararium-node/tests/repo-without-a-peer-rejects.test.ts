/**
 * THE PREMISE of the island's slot wait (`packages/lararium-tw5/src/slot-wait.ts`), pinned on the real library.
 *
 *   R1  an automerge-repo Repo that holds NO connected peer settles a find for a document it does not hold by
 *       REJECTING at once: the library reads "no peer" as "unavailable". An island whose one peer (the vessel's
 *       main thread) has not yet answered the sync port stands exactly there, so its kernel reads such a
 *       rejection as no word about the document.  control: the Repo that holds the document finds it
 */
import { describe, expect, test } from "vitest";
import { Repo, type AutomergeUrl } from "@automerge/automerge-repo";

describe("a Repo with no peer", () => {
  test("R1 — rejects a find for a document it does not hold; the holder finds it", async () => {
    const holder = new Repo({ network: [] });
    const url = holder.create({ held: "elsewhere" }).url as AutomergeUrl;
    const island = new Repo({ network: [] });
    expect(island.peers).toEqual([]);
    // The kernel classifies a rejection as absence by this wording; a reworded library reds here first.
    await expect(island.find(url)).rejects.toThrow(/is unavailable/);
    await expect(island.find("automerge:bogus-slot-url" as AutomergeUrl)).rejects.not.toThrow(/is unavailable/);
    expect((await holder.find<{ held: string }>(url)).doc()?.held).toBe("elsewhere");
  });
});
