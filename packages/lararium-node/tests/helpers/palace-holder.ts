import { resolveContentPalaceSpawn } from "@lararium/mempalace";
import { describe, test } from "vitest";

const CONTENT_PALACE_SPAWN = resolveContentPalaceSpawn();

/** Tells whether the content palace holder resolves a mempalace python and serve script. */
export const PALACE_HOLDER_STANDS = CONTENT_PALACE_SPAWN.python !== null && CONTENT_PALACE_SPAWN.scriptPresent;

/** Wraps a suite so local runs skip when mempalace python is absent and CI fails loud instead. */
export function palaceSuite(name: string, fn: () => void): void {
  if (PALACE_HOLDER_STANDS) {
    describe(name, fn);
    return;
  }

  if (process.env["CI"]) {
    describe(name, () => {
      test("the CI runner holds no mempalace python: this suite would read zero", () => {
        throw new Error("no python holds mempalace — run `lares mempalace install`");
      });
    });
    return;
  }

  // The reason rides the suite's own name, so every reporter prints why it skipped; a collection-time log never reaches one.
  describe.skip(`INCONCLUSIVE (no python holds mempalace; lares mempalace install) — ${name}`, fn);
}
