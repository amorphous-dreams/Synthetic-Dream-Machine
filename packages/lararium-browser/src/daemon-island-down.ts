/**
 * The browser's daemon island goes down through its OWN teardown (L29 mirror): the graceful shutdown posts the teardown and
 * awaits the island's answer, so the island runs its settlement round (asks-done -> receipt:close) and an owed write rests
 * or reaches the vessel unsaved by name, never dropped silent. The facade then disposes. The hard kill stays the liveness for
 * a worker wedged alive: the shutdown's own budget terminates it, and a refused shutdown (a restart in flight) still disposes.
 *
 * A tab ATTACHED to the shared holder shares one island with the holder's other tabs: it detaches (dispose closes its
 * session) and never tears that island down; the holder's last-session close runs the island's teardown (`inPageIsland`).
 */
export async function daemonIslandDown(
  vm: { shutdown(budgetMs?: number): Promise<{ acked: boolean }>; dispose(): void },
  opts: { readonly attached: boolean; readonly budgetMs?: number },
): Promise<void> {
  if (!opts.attached) {
    try {
      const { acked } = await vm.shutdown(opts.budgetMs);
      if (!acked) console.warn("[vessel] the daemon island's teardown answered unacked (a named teardown-fault, or its budget cut a wedged worker)");
    } catch (error) {
      console.warn(`[vessel] the daemon island's graceful shutdown refused: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  vm.dispose();
}
