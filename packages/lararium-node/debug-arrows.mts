import { createLarariumRuntime, LARES_ROOT, compileCarrierIndex } from "./src/node-host.js";
import { renderAllViews } from "@lararium/tldraw";
import { parsePranalaEdges } from "@lararium/core";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { resolveLarUri } from "@lararium/core";

const runtime = createLarariumRuntime(LARES_ROOT);
const artifact = runtime.compileBoot();

// Build memes like build-snapshot-lib does
const carriers = compileCarrierIndex();
const memes: Record<string, { text: string }> = {};
for (const carrier of carriers) {
  const resolution = resolveLarUri(carrier.uri);
  if (!resolution.laresRelPath) continue;
  const abs = join(LARES_ROOT, resolution.laresRelPath);
  if (!existsSync(abs)) continue;
  memes[carrier.uri] = { text: readFileSync(abs, "utf8") };
}
console.log("snapshot meme count:", Object.keys(memes).length);
console.log("closure count:", artifact.closure.length);

const emission = await renderAllViews(artifact, {
  readText: (uri: string) => {
    const m = memes[uri];
    if (!m) { console.warn("MISSING:", uri); return null; }
    return m.text;
  },
  includeAhuFrames: true,
});

const arrows = emission.shapes.filter((s: any) => s.type === "arrow");
const frames = emission.shapes.filter((s: any) => s.type === "frame");
console.log("frames:", frames.length, "arrows:", arrows.length, "bindings:", emission.bindings.length);
if (arrows.length > 0) {
  console.log("first 3 arrows:", JSON.stringify(arrows.slice(0,3).map((a:any) => ({id:a.id,color:a.props?.color}))));
}

// Debug: manual edge parse on AGENTS
const agentsText = memes["lar:///AGENTS"]?.text;
if (agentsText) {
  const edges = parsePranalaEdges("lar:///AGENTS", agentsText);
  console.log("\nAGENTS edges:", JSON.stringify(edges, null, 2));
}
