/** The browser's daemon island goes down (today: the hard, no-flush kill; the island runs no teardown). */
export async function daemonIslandDown(vm: { dispose(): void }, _opts: { readonly attached: boolean }): Promise<void> {
  vm.dispose();
}
