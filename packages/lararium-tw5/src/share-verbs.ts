/**
 * share-verbs — the daemon's two share doors over the vessel's control document (the share config, `share-config.ts`).
 *
 *   share-set   writes (or removes) one row `$:/config/lares/share/<slug>`; its filters read as a title list of face pet-names
 *   share-list  answers every row the control document holds
 *
 * The control document rests under the vessel's key and no face reads it, so the rows name faces where no face hive does
 * ("faces don't know each other"). The CLI door writes the same row through to `$LAR_ROOT/config/share.tid`, and each boot
 * reconciles the file in (the file wins). Neither door resolves who reads: the one resolver (`resolveShare`) does, where the
 * faces stand.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-share-config
 */
import {
  mutableLarRecord, parseShareFilter, shareRowFields, shareRowOf, shareRowTitle, SHARE_CONFIG_PREFIX, VerbRefusal,
  type CompositeStore, type ShareRow,
} from "@lararium/mesh";
import type { VerbReactor } from "./verb-dispatcher.js";

const ORIGIN = { kind: "lares-verb", requestId: "share-config" } as const;

/** Every share row the control document holds. */
export async function readShareRows(control: CompositeStore): Promise<ShareRow[]> {
  const out: ShareRow[] = [];
  for (const title of await control.listVisible()) {
    if (!title.startsWith(SHARE_CONFIG_PREFIX)) continue;
    const record = await control.get(title);
    const row = record ? shareRowOf(record.tiddler as Record<string, unknown>) : null;
    if (row) out.push(row);
  }
  return out.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

export function makeShareSetReactor(opts: { readonly control: () => CompositeStore }): VerbReactor {
  return async (args) => {
    const slug = typeof args["slug"] === "string" ? args["slug"].trim() : "";
    let title: string;
    try { title = shareRowTitle(slug); } catch (e) { throw new VerbRefusal("share-slug-malformed", e instanceof Error ? e.message : String(e)); }
    const control = opts.control();
    if (args["remove"] === true) {
      await control.remove(title, ORIGIN);
      return { ok: true, slug, removed: true };
    }
    const read = typeof args["read"] === "string" ? args["read"] : "";
    const write = typeof args["write"] === "string" ? args["write"] : "";
    for (const f of [read, write]) {
      try { parseShareFilter(f); } catch (e) { throw new VerbRefusal("share-filter-unsupported", e instanceof Error ? e.message : String(e)); }
    }
    const row: ShareRow = {
      slug, kind: args["kind"] === "wiki" ? "wiki" : "bag", read, write,
      ...(typeof args["note"] === "string" && args["note"].length > 0 ? { note: args["note"] } : {}),
    };
    const { title: _t, ...fields } = shareRowFields(row);
    await control.put(mutableLarRecord(title, fields, "share-config"), ORIGIN);
    return { ok: true, slug, row: { ...row } };
  };
}

export function makeShareListReactor(opts: { readonly control: () => CompositeStore }): VerbReactor {
  return async () => ({ ok: true, rows: (await readShareRows(opts.control())).map((r) => ({ ...r })) });
}
