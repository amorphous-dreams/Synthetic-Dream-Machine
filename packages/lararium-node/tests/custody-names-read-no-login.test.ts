/**
 * Custody names read no login (T20). A vessel's custody files once took a suffix off the git global `user.email`,
 * so a flipped email (an edit, a `GIT_CONFIG_GLOBAL`, an unset `HOME`, a slow `git`) made the same vessel read as
 * empty, and the mint paths answered "empty" by minting a second identity beside the first. Custody resolves its
 * names from its home alone: a host fact never picks which file a vessel reads.
 */
import { afterAll, describe, expect, test, vi } from "vitest";
import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RandomProvider } from "@lararium/mesh";
import { withLarRoot } from "../../../tests/harness/with-lar-root.js";
import { foundDirect } from "./found-route.js";
import { generateOrLoadPersonaGroupRoot, generateOrLoadVesselIdentity } from "../src/node-vessel-identity.js";
import { larIdentityDir } from "../src/vessel-paths.js";
import { faceRowNames } from "./face-paths.js";

vi.setConfig({ testTimeout: 240_000 });
const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
function root(): string {
  const r = mkdtempSync(join(tmpdir(), "lar-custody-names-"));
  cpSync(join(import.meta.dirname, "../../../genesis"), join(r, "genesis"), { recursive: true, filter: (s) => !s.endsWith("social-bootstrap.json") });
  roots.push(r); return r;
}
function entropy(start: number): RandomProvider {
  let n = start;
  return { getRandomValues<T extends Uint8Array<ArrayBuffer>>(a: T): T { for (let i = 0; i < a.length; i++) a[i] = n++ & 255; return a; }, randomUUID: () => "deterministic" };
}
const at = (r: string) => ({ storageDir: join(r, "data", "lares", "vessel"), genesisDir: join(r, "genesis") });

/** Run `work` with git's global config at a scratch file naming `email`; `flip` rewrites it mid-run. */
async function underEmail<T>(r: string, email: string, work: (flip: (next: string) => void) => Promise<T>): Promise<T> {
  const file = join(r, "gitconfig");
  const write = (e: string): void => writeFileSync(file, `[user]\n\temail = ${e}\n`);
  write(email);
  const prior = process.env["GIT_CONFIG_GLOBAL"];
  process.env["GIT_CONFIG_GLOBAL"] = file;
  try { return await work(write); }
  finally { if (prior === undefined) delete process.env["GIT_CONFIG_GLOBAL"]; else process.env["GIT_CONFIG_GLOBAL"] = prior; }
}
const placeFiles = (): string[] => readdirSync(larIdentityDir()).filter((f) => f.startsWith(".vessel-")).sort();
const rootRows = (): string[] => faceRowNames().filter((f) => f.startsWith(".persona-group-root"));

describe("custody names read no login", () => {
  test("RED: a flipped git email loads the persona root that stands, and mints no second root", async () => {
    const r = root();
    await withLarRoot(r, () => underEmail(r, "a@x.invalid", async (flip) => {
      await foundDirect({ ...at(r), entropy: entropy(1), placeFoundingCard: { readBack: async () => {} } });
      const first = await generateOrLoadPersonaGroupRoot(0);
      flip("b@x.invalid");
      const again = await generateOrLoadPersonaGroupRoot(0);
      expect(again.verifyingKey, "the same root answers").toBe(first.verifyingKey);
      expect(again.created, "nothing mints").toBe(false);
      expect(rootRows(), "one root row stands").toHaveLength(1);
    }));
  });

  test("CONTROL: the unchanged email loads the persona root with created:false", async () => {
    const r = root();
    await withLarRoot(r, () => underEmail(r, "a@x.invalid", async () => {
      await foundDirect({ ...at(r), entropy: entropy(1), placeFoundingCard: { readBack: async () => {} } });
      const first = await generateOrLoadPersonaGroupRoot(0);
      const again = await generateOrLoadPersonaGroupRoot(0);
      expect(again).toEqual({ verifyingKey: first.verifyingKey, created: false });
      expect(rootRows()).toHaveLength(1);
    }));
  });

  test("RED: a found on a flipped git email loads the place key that stands, and mints no second key or KEL", async () => {
    const r = root();
    await withLarRoot(r, () => underEmail(r, "a@x.invalid", async (flip) => {
      await foundDirect({ ...at(r), entropy: entropy(1), placeFoundingCard: { readBack: async () => {} } });
      const standing = placeFiles();
      const first = await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
      flip("b@x.invalid");
      const again = await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
      expect(again.verifyingKey, "the same place key answers").toBe(first.verifyingKey);
      expect(placeFiles(), "no second key or KEL lands").toEqual(standing);
    }));
  });

  test("CONTROL: a found on the unchanged email loads the place key that stands", async () => {
    const r = root();
    await withLarRoot(r, () => underEmail(r, "a@x.invalid", async () => {
      await foundDirect({ ...at(r), entropy: entropy(1), placeFoundingCard: { readBack: async () => {} } });
      const standing = placeFiles();
      const first = await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
      const again = await generateOrLoadVesselIdentity({ placeFoundingCard: { readBack: async () => {} } });
      expect(again.verifyingKey).toBe(first.verifyingKey);
      expect(placeFiles()).toEqual(standing);
    }));
  });
});
