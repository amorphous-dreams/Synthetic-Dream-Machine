import { holdDaemonVm, type DaemonVmCore, type DaemonVmHolder } from "@lararium/tw5";
import type { JoinedFaceAuth } from "@lararium/mesh";

/** A restart whose reason leads with `kapae` (or `kāpae`) is the emergency brake: it fails closed. */
const isEmergency = (reason: string): boolean => /^k[aā]pae/i.test(reason);

/**
 * Stand the daemon island once and hold it for re-opens. Every open (the first and each restart) resolves the plugin inputs through the
 * shared resolver and reads every joined face's CURRENT custody standing, so a plugin change takes effect and a sibling that locked or
 * dropped since boot never rides a re-open. The resolver runs first (`prepare`), so an ordinary refusal leaves the old island standing;
 * a kapae restart fails closed. The manifest carries the lit faces, so the holder replays none.
 */
export async function standDaemonIsland(o: {
  resolvePlugins: () => Promise<{ ok: true; pluginCids: readonly string[] } | { ok: false; error: string }>;
  readJoinedFaces: () => Promise<readonly JoinedFaceAuth[]>;
  open: (inputs: { pluginCids: readonly string[]; joinedFaces: readonly JoinedFaceAuth[] }) => Promise<DaemonVmCore>;
}): Promise<DaemonVmHolder> {
  const resolve = async () => {
    const result = await o.resolvePlugins();
    if (!result.ok) throw new Error(`[openNodeVessel] the daemon island's plugin resolution refused: ${result.error}`);
    return { pluginCids: result.pluginCids };
  };
  const openNow = async (prepared: { pluginCids: readonly string[] }) => o.open({ ...prepared, joinedFaces: await o.readJoinedFaces() });
  const vm = await openNow(await resolve());
  return holdDaemonVm({ vm, prepare: resolve, reopen: (_reason, prepared) => openNow(prepared), emergency: isEmergency, faces: "manifest" });
}
