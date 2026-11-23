/**
 * A loaded document lets its buffers go: the engine the mesh resolves holds a loaded document's wasm memory steady
 * across overwrites of its records.
 *
 * The stock engine split a loaded value column with `split_off` + `truncate` and kept the whole pre-split buffer on
 * every edit (automerge/automerge#1738), so a document of a few thousand stored bodies climbed by hundreds of MB over a
 * few dozen overwrites. The workspace pins a vendored engine carrying the cure (third-party/automerge/README.md).
 *
 * The reading runs in a child node process: wasm memory only grows, and the engine's one instance lives for the whole
 * worker, so a fresh process gives the reading a memory no earlier suite has grown.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const ENGINE = pathToFileURL(createRequire(import.meta.url).resolve("@automerge/automerge")).href;

const PROBE = `
const insts = [];
const Real = WebAssembly.Instance;
WebAssembly.Instance = new Proxy(Real, { construct(t, a) { const i = Reflect.construct(t, a); insts.push(i); return i; } });
const A = await import(${JSON.stringify(ENGINE)});
const mb = () => insts.reduce((s, i) => s + (Object.values(i.exports).find((x) => x instanceof WebAssembly.Memory)?.buffer.byteLength ?? 0), 0) / 1048576;
const body = (i, r) => (\`r\${i}.\${r} \`).repeat(2000).slice(0, 2000);
let d = A.from({ t: {} });
d = A.change(d, (x) => { for (let i = 0; i < 4000; i++) x.t["k" + i] = { title: "k" + i, text: new A.ImmutableString(body(i, 0)) }; });
d = A.load(A.save(d));
const before = mb();
for (let k = 1; k <= 50; k++) d = A.change(d, (x) => { x.t["k" + k].text = new A.ImmutableString(body(k, k)); });
const loadedBack = A.load(A.save(d));
process.stdout.write(JSON.stringify({ instances: insts.length, grewMB: mb() - before, text: String(loadedBack.t.k50.text) === body(50, 50) }));
`;

describe("a loaded document lets its buffers go", () => {
  it("4,000 records of 2 KB, loaded, take 50 overwrites while wasm memory grows by under 4 MB", () => {
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", PROBE], { encoding: "utf8", timeout: 120_000 });
    expect(run.status, run.stderr).toBe(0);
    const read = JSON.parse(run.stdout) as { instances: number; grewMB: number; text: boolean };
    expect(read.instances).toBeGreaterThan(0);
    expect(read.text).toBe(true);
    expect(read.grewMB).toBeLessThan(4);
  }, 150_000);
});
