/**
 * MemeRecipeVm — isomorphic interface for a TW5 wiki engine slot in VmPool.
 *
 * Implementations:
 *   DirectMemeRecipeVm  — in-process TW5Engine wrapper (lives in @lararium/tw5)
 *   TW5WorkerProxy      — Worker-backed implementation (lives in @lararium/tw5)
 *
 * Schema: lar:///ha.ka.ba/@lares/api/v0.1/lararium/schema/meme-recipe-vm
 */
/**
 * Boot a MemeRecipeVm slot and wire it to a MemeProvider.
 *
 * @param provider - MemeProvider managing the corpus/room doc
 * @param factory  - VM factory function
 * @returns `{ vm, unsubscribe }` — call `unsubscribe()` to detach from provider.
 */
export async function bootMemeRecipeVm(provider, factory) {
    const vm = factory();
    const unsubscribe = provider.addProjection(vm);
    return { vm, unsubscribe };
}
//# sourceMappingURL=meme-recipe-vm.js.map