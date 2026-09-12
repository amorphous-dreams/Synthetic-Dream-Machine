/**
 * herm-cas-transit.test.ts — THE HERM SHORE AS A TRANSIT LEG of the fetch door (basket-one #/the-fetch-door:
 * "a public blob travels to a Herm before any hearth serves it").
 *
 * A fleet peer's read misses `cid/`, asks the fleet over Socket B, and — the fleet dark — asks the Herm's public
 * read-face `GET /cas/<cid>` (0449d1bab). `hermCasTransit(url)` is that leg: one holder (the Herm), one GET; the
 * resolver verifies the bytes against the cid and writes through, exactly as the fleet leg does.
 * `composeCasTransits(fleet, herm)` asks the fleet FIRST and the Herm after — a dark fleet costs one miss, never
 * the bytes. CONTROLS: a Herm answering 404 → null, nothing written; a Herm answering WRONG bytes → rejected,
 * nothing written (a hostile shore cannot poison the read); no Herm named → the fleet leg alone, unchanged.
 */
import { afterEach, describe, test, expect } from "vitest";
import { createServer, type Server } from "node:http";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeCidResolver, sha256HexBytesSync, utf8Bytes, type CasTransitTransport } from "@lararium/mesh";
import { hermCasTransit, composeCasTransits, readCasBlobFromFs, writeCasEntriesFs } from "../src/node-cas.js";

const servers: Server[] = [];
const dirs: string[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise<void>((r) => s.close(() => r()));
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A fake Herm read-face: `/cas/<cid>` answers the bytes `serve` names, 404 otherwise. */
async function fakeHerm(serve: Record<string, Uint8Array>): Promise<string> {
  const s = createServer((req, res) => {
    const m = /^\/cas\/([0-9a-f]{64})$/.exec(req.url ?? "");
    const bytes = m ? serve[m[1]!] : undefined;
    if (!bytes) { res.writeHead(404, { "content-type": "text/plain" }); res.end("unknown or stale bulb cid"); return; }
    res.writeHead(200, { "content-type": "application/octet-stream" }); res.end(Buffer.from(bytes));
  });
  servers.push(s);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", () => r()));
  return `http://127.0.0.1:${(s.address() as { port: number }).port}`;
}

/** A fleet leg with every holder dark. */
const darkFleet: CasTransitTransport = { discover: async () => ["fleet-peer-a"], fetchBlock: async () => null };

describe("hermCasTransit — the Herm's /cas/<cid> as the fetch door's last leg", () => {
  test("★ the fleet dark, the read reaches the Herm: bytes verify and land write-through ★", async () => {
    const likeness = utf8Bytes("a public png the family shared"); const cid = sha256HexBytesSync(likeness);
    const herm = await fakeHerm({ [cid]: likeness });
    const casDir = mkdtempSync(join(tmpdir(), "lr-herm-transit-")); dirs.push(casDir);
    const asked: string[] = [];
    const fleet: CasTransitTransport = { ...darkFleet, fetchBlock: async (c, h) => { asked.push(h); return null; } };
    const resolve = makeCidResolver(
      (c) => readCasBlobFromFs(c, casDir),
      composeCasTransits(fleet, hermCasTransit(herm)),
      (c, bytes) => { writeCasEntriesFs([{ cid: c, bytes }], casDir); },
    );
    const got = await resolve(cid);
    expect(got && sha256HexBytesSync(got)).toBe(cid);
    expect(asked, "the fleet is asked FIRST").toEqual(["fleet-peer-a"]);
    expect(existsSync(join(casDir, cid))).toBe(true);
  });

  test("CONTROL: the Herm answers 404 → null, nothing written", async () => {
    const ghost = sha256HexBytesSync(utf8Bytes("a likeness nobody ever staged"));
    const herm = await fakeHerm({});
    const casDir = mkdtempSync(join(tmpdir(), "lr-herm-transit-")); dirs.push(casDir);
    const resolve = makeCidResolver((c) => readCasBlobFromFs(c, casDir), composeCasTransits(darkFleet, hermCasTransit(herm)),
      (c, bytes) => { writeCasEntriesFs([{ cid: c, bytes }], casDir); });
    expect(await resolve(ghost)).toBeNull();
    expect(existsSync(join(casDir, ghost))).toBe(false);
  });

  test("CONTROL: a Herm answering the WRONG bytes is rejected — nothing written", async () => {
    const real = utf8Bytes("the real likeness"); const cid = sha256HexBytesSync(real);
    const herm = await fakeHerm({ [cid]: utf8Bytes("a forgery under the real cid") });
    const casDir = mkdtempSync(join(tmpdir(), "lr-herm-transit-")); dirs.push(casDir);
    const resolve = makeCidResolver((c) => readCasBlobFromFs(c, casDir), composeCasTransits(darkFleet, hermCasTransit(herm)),
      (c, bytes) => { writeCasEntriesFs([{ cid: c, bytes }], casDir); });
    expect(await resolve(cid)).toBeNull();
    expect(existsSync(join(casDir, cid))).toBe(false);
  });

  test("CONTROL: no Herm named → the fleet leg alone, its holders unchanged", async () => {
    const composed = composeCasTransits(darkFleet, null);
    expect(await composed.discover("x".repeat(64))).toEqual(["fleet-peer-a"]);
  });
});
