/**
 * device-admit-daemon-doc-wait — the admit reads its hearth's daemon doc on the document's own events (clock-sweep
 * step 3): ready opens it, unavailable refuses by name at once, and no clock of the admit's own decides.
 */
import { Repo } from "@automerge/automerge-repo";
import { DocumentUnavailableRefusal, emptyLarDoc, type LarDoc } from "@lararium/mesh";
import { expect, test } from "vitest";
import { openHearthDaemonDoc } from "../src/commands/device-admit.js";

test("RED (clock-sweep): a daemon doc no peer holds refuses by name, at once", async () => {
  const repo = new Repo();
  const absent = new Repo().create<LarDoc>(emptyLarDoc()).url;
  const refusal = await openHearthDaemonDoc(repo, absent).then(() => null, (error: unknown) => error);
  expect(refusal).toBeInstanceOf(DocumentUnavailableRefusal);
  expect(String((refusal as Error).message)).toMatch(/the hearth's daemon doc/);
  await repo.shutdown();
}, 3_000);

test("CONTROL: a daemon doc the vessel holds opens", async () => {
  const repo = new Repo();
  const handle = repo.create<LarDoc>(emptyLarDoc());
  expect((await openHearthDaemonDoc(repo, handle.url)).url).toBe(handle.url);
  await repo.shutdown();
});
