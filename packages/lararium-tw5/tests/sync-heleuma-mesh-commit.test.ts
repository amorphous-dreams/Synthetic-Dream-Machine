import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test, vi } from "vitest";
import { frameCarrier, verifyBcc } from "@lararium/memetic-frame";

test("--commit restamps the mesh anchor and the next dry run reads it clean", async () => {
  const root = mkdtempSync(join(tmpdir(), "heleuma-mesh-"));
  // All paths below belong to this freshly created scratch tree.
  const fixture = { anchor: join(root, "bags/lararium/ha.ka.ba/lararium/mesh/wave-crest.mem") };
  const source = join(root, "packages/lararium-mesh/src/wave-crest.ts");
  const tid = join(root, "packages/lararium-tw5/tiddlers/wave-crest-source.tid");
  const title = "lar:///ha.ka.ba/lararium/mesh/wave-crest-source";
  const code = "export const wave = 1;\n";
  for (const path of [fixture.anchor, source, tid]) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(source, code);
  writeFileSync(tid, `title: ${title}\ntype: text/plain\n\n${code}`);
  writeFileSync(fixture.anchor, frameCarrier({ head: { uri: "lar:///ha.ka.ba/lararium/mesh/wave-crest" }, body:
    `\`\`\`toml meta\ntitle = "lar:///ha.ka.ba/lararium/mesh/wave-crest"\nheleuma = "ka"\nmodule-ref = "${title}"\nsource-sha256 = "sha256:stale"\n\`\`\`\n\n<<~ ahu slot=\`#/source\`>>\n<$transclude $tiddler="${title}"/>\n<<~/ahu>>` }));
  const originalArgs = process.argv;
  const originalExit = process.exitCode;
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.doMock("@lararium/mesh/node", () => ({ repoRoot: root }));
  vi.doMock("child_process", () => ({ execSync: () => {} }));
  const run = async (args: string[]) => { vi.resetModules(); process.argv = ["node", "sync-heleuma", ...args]; process.exitCode = 0; await import("../scripts/sync-heleuma.js"); };
  try {
    await run([]);
    expect(process.exitCode).toBe(1);
    await run(["--commit"]);
    expect(verifyBcc(readFileSync(fixture.anchor, "utf8"))).toBe("ok");
    await run([]);
    expect(process.exitCode).toBe(0);
  } finally {
    process.argv = originalArgs; process.exitCode = originalExit;
    vi.doUnmock("@lararium/mesh/node"); vi.doUnmock("child_process");
    log.mockRestore(); warn.mockRestore(); rmSync(root, { recursive: true, force: true });
  }
});
