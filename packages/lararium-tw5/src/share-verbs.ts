/**
 * share-verbs — the daemon's two share doors over the vessel's control document (the share config, `share-config.ts`).
 *
 *   share-set   writes (or removes) one row `$:/config/lares/share/<slug>`; its filters read as a title list of face pet-names,
 *               a wiki row may name a `workspace`, the daemon wiki refuses `share-face-private`, and a row of the other
 *               kind standing for the slug refuses `share-kind-standing` (unshare it first)
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
  assertShareKindFree,
  parseShareFilter,
  shareEntryFields,
  shareEntryOf,
  shareEntryTitle,
  shareEntryWorkspace,
  ShareConfigRefusal,
  SHARE_CONFIG_PREFIX,
  type ShareEntry,
} from "@lararium/mesh/share-config";
import { mutableLarRecord } from "@lararium/mesh/base-doc";
import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { type CompositeStore } from "@lararium/mesh/composite-store";
import type { VerbReactor } from "./verb-dispatcher.js";

const ORIGIN = { kind: "lares-verb", requestId: "share-config" } as const;

/** Every share row the control document holds. */
export async function readShareEntries(control: CompositeStore): Promise<ShareEntry[]> {
  const out: ShareEntry[] = [];
  for (const title of await control.listVisible()) {
    if (!title.startsWith(SHARE_CONFIG_PREFIX)) continue;
    const record = await control.get(title);
    const row = record ? shareEntryOf(record.tiddler as Record<string, unknown>) : null;
    if (row) out.push(row);
  }
  return out.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

export function makeShareSetReactor(opts: { readonly control: () => CompositeStore }): VerbReactor {
  return async (args) => {
    const slug = typeof args["slug"] === "string" ? args["slug"].trim() : "";
    let title: string;
    // A malformed slug and the daemon wiki (face-private, `share-face-private`) both refuse by their own name.
    try { title = shareEntryTitle(slug); } catch (e) { throw new VerbRefusal(e instanceof ShareConfigRefusal ? e.reason : "share-slug-malformed", e instanceof Error ? e.message : String(e)); }
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
    const workspace = typeof args["workspace"] === "string" ? args["workspace"].trim() : "";
    // THE ROW KEEPS ITS OWNER, by pet-name, as the file's row does: `ownerOf` reads it, so a reader whose half names the bag by
    // reference never reads as the owner and delegates the bag onward.
    const owner = typeof args["owner"] === "string" ? args["owner"].trim() : "";
    const kind: ShareEntry["kind"] = args["kind"] === "wiki" ? "wiki" : "bag";
    const held = await control.get(title);
    const standing = held ? shareEntryOf(held.tiddler as Record<string, unknown>)?.kind : null;
    try { assertShareKindFree(slug, kind, standing); } catch (e) { throw new VerbRefusal("share-kind-standing", e instanceof Error ? e.message : String(e)); }
    const row: ShareEntry = {
      slug, kind, read, write,
      ...(workspace ? { workspace } : {}),
      ...(owner ? { owner } : {}),
      ...(typeof args["note"] === "string" && args["note"].length > 0 ? { note: args["note"] } : {}),
    };
    try { shareEntryWorkspace(row); } catch (e) { throw new VerbRefusal("share-workspace-malformed", e instanceof Error ? e.message : String(e)); }
    const { title: _t, ...fields } = shareEntryFields(row);
    await control.put(mutableLarRecord(title, fields, "share-config"), ORIGIN);
    return { ok: true, slug, row: { ...row } };
  };
}

export function makeShareListReactor(opts: { readonly control: () => CompositeStore }): VerbReactor {
  return async () => ({ ok: true, rows: (await readShareEntries(opts.control())).map((r) => ({ ...r })) });
}
