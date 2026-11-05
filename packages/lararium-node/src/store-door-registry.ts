/**
 * store-door-registry — the store door's reactors join the main-thread verb table by name.
 *
 * The panel owns the island route of the shared promote verbs (`PROMOTE_PANEL_OWNED_ROWS`): this skips exactly that named set, because
 * the panel's handler of the name is already registered and the door's own reactor serves its socket and CLI road alone. Every other
 * name registers, and a duplicate throws `duplicate handler` as the table's guard does.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { PROMOTE_PANEL_OWNED_ROWS } from "@lararium/mesh";
import type { VerbReactor, VerbTable } from "@lararium/tw5";

export function registerStoreDoorReactors(registry: VerbTable, doors: Readonly<Record<string, VerbReactor>>): void {
  for (const [verb, reactor] of Object.entries(doors)) {
    if (PROMOTE_PANEL_OWNED_ROWS.has(verb)) continue;
    registry.register(verb, reactor);
  }
}
