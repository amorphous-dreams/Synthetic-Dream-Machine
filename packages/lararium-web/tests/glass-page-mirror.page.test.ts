import { afterEach, beforeEach, expect, test } from "vitest";
import { standPageMirror } from "../src/page-mirror.js";
import { forgetEvidence, rig } from "./glass-rig.js";

beforeEach(forgetEvidence); afterEach(forgetEvidence);
const attr = (host: HTMLElement) => host.getAttribute("data-lar-mirror");

test("the page root stands its mirror from the vessel's mirrorInputs and tells the host element how wide it stands", async () => {
  const r = await rig(); const asked: string[] = [];
  try {
    const result = await standPageMirror({ port: r.port, host: r.host, actor: "did:key:zActor", surface: () => "lares",
      mirrorInputs: async surface => { asked.push(surface); return { coreCid: "0".repeat(64), pluginCids: [] }; } }, r.seams) as any;
    expect(asked).toEqual(["lares"]);
    expect(result.kind).toBe("mirror");
    expect(r.opens()[0]).toMatchObject({ wikiUri: "lares", actor: "did:key:zActor", width: "skinny" });
    expect(attr(r.host)).toBe("skinny");
    await result.settled;
    expect(attr(r.host)).toBe("full");
    result.unmount();
  } finally { r.host.remove(); }
});
test("no surface, or inputs the vessel cannot name, leaves the none projection alone and the host marked", async () => {
  const r = await rig();
  try {
    const noSurface = await standPageMirror({ port: r.port, host: r.host, actor: "a", surface: () => null, mirrorInputs: async () => null }, r.seams);
    expect(noSurface).toEqual({ kind: "floor", width: "none", why: "surface-unknown" });
    expect(attr(r.host)).toBe("none:surface-unknown");
    const noInputs = await standPageMirror({ port: r.port, host: r.host, actor: "a", surface: () => "lares", mirrorInputs: async () => null }, r.seams);
    expect(noInputs).toEqual({ kind: "floor", width: "none", why: "mirror-inputs-absent" });
    expect(r.opens()).toHaveLength(0);
  } finally { r.host.remove(); }
});
