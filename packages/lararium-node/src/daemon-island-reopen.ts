import { holdDaemonVm, KAPAE_EMERGENCY_REASON, type DaemonVmCore, type DaemonVmHolder } from "@lararium/tw5";
import type { JoinedFaceAuth } from "@lararium/mesh";

/** The emergency brake is the ONE exported reason, matched exactly: a prose or prefix match would leave the brake open. */
const isEmergency = (reason: string): boolean => reason === KAPAE_EMERGENCY_REASON;

/**
 * Stand the daemon island once and hold it for re-opens. Every open (the first and each restart) resolves the plugin inputs through the
 * shared resolver and reads every joined face's CURRENT custody standing, so a plugin change takes effect and a sibling that holds its custody locked or
 * dropped at the open never rides it. The resolver runs first (`prepare`), so an ordinary refusal leaves the standing island running;
 * the kapae emergency fails closed. The manifest carries the lit faces, so the holder replays none.
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
