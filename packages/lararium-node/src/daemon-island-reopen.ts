import { holdDaemonVm, type DaemonVmCore, type DaemonVmHolder } from "@lararium/tw5";

/** Resolve the daemon island's current plugin inputs before each open. */
export async function standDaemonIsland(o: {
  resolvePlugins: () => Promise<{ ok: true; pluginCids: readonly string[] } | { ok: false; error: string }>;
  open: (inputs: { pluginCids: readonly string[] }) => Promise<DaemonVmCore>;
}): Promise<DaemonVmHolder> {
  const resolve = async () => {
    const result = await o.resolvePlugins();
    if (!result.ok) throw new Error(`[openNodeVessel] the daemon island's plugin resolution refused: ${result.error}`);
    return { pluginCids: result.pluginCids };
  };
  const inputs = await resolve();
  const vm = await o.open(inputs);
  return holdDaemonVm({ vm, prepare: resolve, reopen: (_r, prepared) => o.open(prepared) });
}
