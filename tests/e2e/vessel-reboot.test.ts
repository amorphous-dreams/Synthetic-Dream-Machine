/**
 * e2e/vessel-reboot — the long-lived-hearth vector: a vessel MUST survive a restart on its own fed store, and
 * every record it held before the stop MUST read back after it.
 *
 * The admin island once never signalled readiness when it re-mounted existing state, so a REBOOT on a fed store
 * died at `openAdminVm ea timeout` while a fresh store booted every time ("readiness reads local").
 *
 * The vector: a staged vessel boots → LOADs the whole lares corpus → the daemon stops AT ONCE, while the load's
 * after-waves still run (root PRESERVED via `stopDaemonOnly`) → its stop completes its main-replica flush, whatever
 * its budget cut → a second daemon boots the SAME root on the SAME port → it reaches `phase → live` → every carrier
 * of the corpus reads back whole, with no quarantine. A stop that loses or tears a LOADed record reads red here.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { stopChild, targetInstance, vesselStorageDir, type LarInstance } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");
const NODE_CWD  = join(REPO_ROOT, "packages/lararium-node");
// The WHOLE corpus — the live failure rode a 1,464-record store while a
// single-meme reboot passed; the vector must carry the real load.
// `@` marks a SURFACE (the bag); the content tree inside it reads bare.
const CORPUS    = join(REPO_ROOT, "bags/lares/ha.ka.ba/lares");
const LARES_URI = "lar:///ha.ka.ba/bags/lares";
/** How many reads run at once. */
const READERS = 8;

let lar: LarInstance;
let second: ChildProcess | null = null;
let secondLog = "";

beforeAll(async () => {
  lar = await targetInstance();
}, 180_000);

afterAll(async () => {
  if (second) await stopChild(second);
  if (lar.mode === "staged") rmSync(lar.root, { recursive: true, force: true });
  await lar.stop();
});

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

/** Every carrier title the corpus declares. */
function corpusUris(): string[] {
  return walk(CORPUS).filter((f) => f.endsWith(".mem")).sort().flatMap((f) => {
    const m = /^title\s*=\s*"([^"]+)"/m.exec(readFileSync(f, "utf8"));
    return m ? [m[1]!] : [];
  });
}

/** Read each carrier through the standing vessel: its body, or `MISSING` and the refusal, keyed by title. */
async function readBack(uris: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let next = 0;
  const reader = async (): Promise<void> => {
    while (next < uris.length) {
      const uri = uris[next++]!;
      const r = await lar.cli(["meme", "get", uri, "--recipe", "lares", "--json"]);
      const text = (r.json?.["data"] as { text?: unknown } | undefined)?.text;
      out.set(uri, r.json?.["ok"] === true && typeof text === "string" ? text : `MISSING ${JSON.stringify(r.json?.["error"] ?? r.stderr.slice(-200))}`);
    }
  };
  await Promise.all(Array.from({ length: READERS }, reader));
  return out;
}

describe("vessel reboot — a hearth survives restarting on its own fed store", () => {
  test("boot → feed → stop at once → REBOOT reaches live → every LOADed carrier reads back", async () => {
    if (lar.mode !== "staged") return;     // lifecycle-mutating — staged only

    const fed = await lar.cli(["act", "LOAD", "--source-uri", CORPUS, "--to", LARES_URI, "--yes", "--json"]);
    expect(fed.json?.["ok"]).toBe(true);

    // THE STOP IS THE FLUSH. SIGTERM flushes the main replica before any island teardown, the budget bounds only
    // that teardown, and the main replica flushes again before the exit, cut or not. `stopDaemonOnly` returns on
    // the daemon's exit, so the second daemon meets the store the first one finished writing.
    await lar.stopDaemonOnly();
    const stopLines = lar.bootLog().split("\n").filter((l) => /shutdown|teardown/.test(l));
    process.stderr.write(`vessel-reboot stop: ${JSON.stringify(stopLines)}\n`);
    expect(stopLines.some((l) => /shutdown complete — the main replica flushed durably/.test(l))).toBe(true);

    // A temp a cut island write left reads as stranded at the next open, never as a chunk; it is named, not fatal.
    const store = vesselStorageDir(lar);
    process.stderr.write(`vessel-reboot temps after stop: ${JSON.stringify(walk(store).filter((f) => f.endsWith(".tmp")))}\n`);

    // SAME port as the first daemon — the live failures all rebooted on the
    // original port; the reboot must own the dead daemon's whole seat.
    second = spawn(process.execPath, [NODE_MAIN, "--root", lar.root, "--port", String(lar.port)], {
      cwd: NODE_CWD,
      env: { ...process.env, LAR_ROOT: lar.root, LAR_PORT: String(lar.port) },
    });
    second.stdout?.on("data", (d) => { secondLog += String(d); });
    second.stderr?.on("data", (d) => { secondLog += String(d); });

    await new Promise<void>((resolve, reject) => {
      const t0 = performance.now();
      const poll = setInterval(() => {
        if (secondLog.includes("phase → live")) { clearInterval(poll); resolve(); }
        else if (second!.exitCode !== null) { clearInterval(poll); reject(new Error(`reboot daemon exited ${second!.exitCode}:\n${secondLog.slice(-800)}`)); }
        else if (performance.now() - t0 > 120_000) { clearInterval(poll); reject(new Error(`reboot never reached live:\n${secondLog.slice(-800)}`)); }
      }, 500);
    });
    expect(secondLog).toContain("phase → live");
    expect(readdirSync(store).filter((n) => n.startsWith("quarantine"))).toEqual([]);

    const uris = corpusUris();
    expect(uris.length).toBeGreaterThan(300);
    const after = await readBack(uris);
    expect([...after.entries()].filter(([, v]) => v.startsWith("MISSING")).slice(0, 10)).toEqual([]);
    // Each carrier reads back as itself: its body names its own title.
    expect([...after.entries()].filter(([uri, v]) => !v.includes(`"${uri}"`)).map(([uri]) => uri).slice(0, 10)).toEqual([]);
  }, 600_000);
});
