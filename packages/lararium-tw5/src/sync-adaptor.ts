/**
 * LarariumCrdtSyncAdaptor — TW5 SyncAdaptor backed by LarTiddlerStore.
 *
 * Binds a hosted TW5 wiki to a LarTiddlerStore so TW5's syncer treats the
 * store as its remote backend. Implements the TW5 SyncAdaptor contract.
 *
 * Echo-loop guard:
 *   - When the store fires a change with origin.kind === "tw-local" and the
 *     instanceId matches ours, skip applying it to $tw.wiki (we sent it).
 *   - When the store fires a change with origin.kind === "crdt-remote", apply
 *     to $tw.wiki but suppress the resulting wiki change event from writing
 *     back to the store (we received it, not generated it).
 *
 * Canon guard (hard rule):
 *   saveTiddler MUST NOT write to lares/.
 *   Callers that need canon promotion must use the Orichalcum ceremony path
 *   (separate route, not this adaptor).
 *
 * Draft guard:
 *   Session-local tiddlers ($:/temp/*, "Draft of ...") MUST NOT reach shared
 *   store state. The adaptor filters them from saveTiddler.
 */

import type { LarTiddlerStore, LarTiddlerRecord, ChangeOrigin } from "@lararium/core";
import type { LarariumTW5 } from "./lararium-tw5.js";
import { serializeCarrier, replaceCarrierSlot, removeCarrierSlot, composeCarrierSlotBody } from "./carrier-split.js";

type SaveStrategy = "skip" | "direct" | "child-carrier";
type SaveHandler  = (
  title:    string,
  fields:   Record<string, string>,
  revision: string,
  origin:   ChangeOrigin,
) => Promise<void>;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isSessionLocal(title: string): boolean {
  return title.startsWith("$:/temp/") || title.startsWith("Draft of ");
}

function isTW5System(title: string): boolean {
  return title.startsWith("$:/");
}

function extractFields(tiddler: unknown): Record<string, string> {
  if (!tiddler || typeof tiddler !== "object") return {};
  const t = tiddler as Record<string, unknown>;
  const out: Record<string, string> = {};
  const flatten = (k: string, v: unknown) => {
    if (typeof v === "string") { out[k] = v; }
    else if (Array.isArray(v)) { out[k] = (v as unknown[]).map(String).join(" "); }
    // other types (number, boolean) intentionally omitted — not valid tiddler fields
  };
  for (const [k, v] of Object.entries(t)) {
    if (k === "fields" && typeof v === "object" && v !== null) {
      // Some TW5 versions nest fields inside .fields
      for (const [fk, fv] of Object.entries(v as Record<string, unknown>)) flatten(fk, fv);
    } else {
      flatten(k, v);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// LarariumCrdtSyncAdaptor
// ---------------------------------------------------------------------------

export class LarariumCrdtSyncAdaptor {
  readonly name = "lararium-crdt";

  private _applying: ChangeOrigin | null = null;
  private _revisions = new Map<string, string>();
  private _pendingModifications = new Set<string>();
  private _pendingDeletions = new Set<string>();
  private _unsubscribe: (() => void) | null = null;

  constructor(
    private readonly tw5: LarariumTW5,
    private readonly store: LarTiddlerStore,
    readonly instanceId: string,
  ) {}

  /**
   * Start listening to store changes and applying them to the TW5 wiki.
   * Call once after the TW5 instance has booted and the store is ready.
   * Returns an unsubscribe function for cleanup.
   */
  start(): () => void {
    this._unsubscribe = this.store.subscribe((change) => {
      // Skip changes we emitted ourselves.
      if (
        change.origin.kind === "tw-local" &&
        (change.origin as { instanceId: string }).instanceId === this.instanceId
      ) return;

      // Apply remote change to TW5 wiki under echo guard.
      this._applying = change.origin;
      try {
        if (change.record === null || change.record.deleted) {
          // Remove parent tiddler + all ahu children (tagged with parent URI).
          this.tw5.removeTiddler(change.title);
          const childTitles: string[] = this.tw5.filterTiddlers(`[tag[${change.title}]has[ahu-slot]]`);
          for (const t of childTitles) this.tw5.removeTiddler(t);
          this._pendingDeletions.add(change.title);
        } else {
          const rec = change.record;
          const isCarrier = rec.text !== undefined &&
            (rec.fields["content-type"] === "text/x-memetic-wikitext" ||
              (!rec.fields["content-type"] && change.title.startsWith("lar:")));

          if (isCarrier && rec.text) {
            // Remove stale ahu children before re-splitting.
            const staleChildren: string[] = this.tw5.filterTiddlers(`[tag[${change.title}]has[ahu-slot]]`);
            for (const t of staleChildren) this.tw5.removeTiddler(t);
            // Deserialize via TW5 native deserializer → [parent, ...children].
            const tiddlers = this.tw5.deserializeCarrier(change.title, rec.text, rec.fields as Record<string, string | string[]>);
            for (const t of tiddlers) this.tw5.setTiddler(t as Record<string, string | string[]>);
          } else {
            const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
            if (rec.text !== undefined) fields["text"] = rec.text;
            this.tw5.setTiddler(fields);
          }

          this._pendingModifications.add(change.title);
          if (change.revision) this._revisions.set(change.title, change.revision);
        }
      } finally {
        this._applying = null;
      }
    });
    return () => this._unsubscribe?.();
  }

  stop(): void {
    this._unsubscribe?.();
    this._unsubscribe = null;
  }

  // ---------------------------------------------------------------------------
  // TW5 SyncAdaptor contract
  // ---------------------------------------------------------------------------

  getStatus(
    callback: (err: Error | null, isLoggedIn: boolean, username: string, isReadOnly: boolean, isAnonymous: boolean) => void,
  ): void {
    callback(null, true, "lararium-operator", false, false);
  }

  getTiddlerInfo(_tiddler: unknown): { revision?: string } {
    const t = _tiddler as { fields?: { title?: string }; title?: string };
    const title = t?.fields?.title ?? t?.title ?? "";
    const rev = this._revisions.get(title);
    return rev !== undefined ? { revision: rev } : {};
  }

  getTiddlerRevision(title: string): string | undefined {
    return this._revisions.get(title);
  }

  getSkinnyTiddlers(
    callback: (err: Error | null, tiddlers: { title: string; revision?: string }[]) => void,
  ): void {
    this.store.listVisible().then((titles) => {
      const skinny = titles.map((title) => {
        const rev = this._revisions.get(title);
        return rev !== undefined ? { title, revision: rev } : { title };
      });
      callback(null, skinny);
    }).catch((err: Error) => callback(err, []));
  }

  loadTiddler(
    title: string,
    callback: (err: Error | null, fields: Record<string, unknown> | null) => void,
  ): void {
    this.store.get(title).then((rec) => {
      if (!rec || rec.deleted) { callback(null, null); return; }
      const fields: Record<string, unknown> = { title: rec.title, ...rec.fields };
      if (rec.text !== undefined) fields["text"] = rec.text;
      callback(null, fields);
    }).catch((err: Error) => callback(err, null));
  }

  saveTiddler(
    tiddler: unknown,
    callback: (err: Error | null, adaptorInfo: unknown, revision: string) => void,
  ): void {
    if (this._applying !== null) { callback(null, {}, "0"); return; }

    const fields = extractFields(tiddler);
    const title  = fields["title"] ?? "";
    const strategy = this._resolveSaveStrategy(title, fields);

    if (strategy === "skip") { callback(null, {}, "0"); return; }

    const revision = String(Date.now());
    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };

    this._saveHandlers[strategy](title, fields, revision, origin)
      .then(() => callback(null, {}, revision))
      .catch((err: Error) => callback(err, {}, revision));
  }

  // ---------------------------------------------------------------------------
  // Save cascade — ordered filter rules, first match wins.
  //
  // Each rule is a TW5 filter expression evaluated against the tiddler title.
  // [[title]<filter>] returning a non-empty list means the rule matches.
  //
  // Extend by adding rules before the catch-all "direct" entry.
  // ---------------------------------------------------------------------------

  private static readonly SAVE_CASCADE: Array<{ filter: string; strategy: SaveStrategy }> = [
    { filter: "[is[system]]",   strategy: "skip"          }, // $:/ system tiddlers
    { filter: "[prefix[$:/temp/]]", strategy: "skip"       }, // session drafts
    { filter: "[prefix[Draft of ]]", strategy: "skip"      }, // TW5 draft tiddlers
    { filter: "[has[ahu-parent]]",   strategy: "child-carrier" }, // ahu child → reconstruct parent carrier
    { filter: "[prefix[lar:]]",      strategy: "direct"    }, // canonical meme → write as-is
  ];

  private _resolveSaveStrategy(title: string, fields: Record<string, string> = {}): SaveStrategy {
    if (isSessionLocal(title) || isTW5System(title)) return "skip";

    // Prefer explicit field/title facts. TW5's filter engine only sees titles
    // that are already in the wiki; saveTiddler can be called with a fresh
    // tiddler object, so the cascade below is advisory rather than the only
    // route.
    if (fields["ahu-parent"]) return "child-carrier";
    const currentFields = this.tw5.wiki.getTiddler?.(title)?.fields ?? {};
    if (currentFields["ahu-parent"]) return "child-carrier";
    const hash = title.lastIndexOf("#");
    if (title.startsWith("lar:") && hash > 0 && this.tw5.wiki.getTiddler?.(title.slice(0, hash))) {
      return "child-carrier";
    }
    if (title.startsWith("lar:")) return "direct";

    const wiki = this.tw5.wiki;
    for (const { filter, strategy } of LarariumCrdtSyncAdaptor.SAVE_CASCADE) {
      try {
        const result: string[] = wiki.filterTiddlers(`[[${title}]${filter}]`);
        if (result.length > 0) return strategy;
      } catch { /* malformed filter — skip rule */ }
    }
    return "skip"; // default: unknown tiddler types are not synced
  }

  private readonly _saveHandlers: Record<SaveStrategy, SaveHandler> = {
    skip: async () => { /* no-op */ },

    direct: async (title, fields, revision, origin) => {
      this._revisions.set(title, revision);
      const textVal = fields["text"];
      const record: LarTiddlerRecord = {
        title,
        fields: Object.fromEntries(
          Object.entries(fields)
            .filter(([k]) => k !== "text" && k !== "title")
            .map(([k, v]) => [k, String(v)])
        ),
        ...(textVal !== undefined ? { text: textVal } : {}),
        revision,
        bag: "room",
      };
      await this.store.put(record, origin);
    },

    "child-carrier": async (title, fields, revision, origin) => {
      const inferred = this._inferChildCarrierTitle(title);
      const parentUri = fields["ahu-parent"] ?? inferred?.parentUri ?? "";
      if (!parentUri) return;

      const wiki = this.tw5.wiki;
      const parentTiddler = wiki.getTiddler?.(parentUri);
      const parentFields: Record<string, string | string[]> = parentTiddler?.fields ?? {};
      const rawCarrierText: string = String(parentFields["text"] ?? "");

      // Determine the slot that changed (child title = parentUri + "#slot").
      const slot = title.startsWith(parentUri) ? title.slice(parentUri.length) : (inferred?.slot ?? null);
      const newSlotBody = composeCarrierSlotBody(fields, fields["text"] ?? "");

      // Prefer surgical replacement to preserve decorators and all other slots.
      // Fall back to full reconstruction if the slot pattern isn't found in the raw text.
      let reconstructed: string;
      if (slot && rawCarrierText) {
        const spliced = replaceCarrierSlot(rawCarrierText, slot, newSlotBody);
        if (spliced !== null) {
          reconstructed = spliced;
        } else {
          // Slot not found in raw text — full reconstruct from all sibling children.
          const childTitles: string[] = this.tw5.filterTiddlers(`[tag[${parentUri}]has[ahu-slot]]`);
          const children = childTitles.map((ct) => {
            const ct5 = wiki.getTiddler?.(ct);
            const cf  = ct5?.fields ?? {};
            return {
              title: ct,
              fields: { ...cf, "ahu-slot": cf["ahu-slot"] ?? "", "ahu-parent": parentUri, tags: [parentUri] },
              text: String(cf["text"] ?? ""),
            };
          });
          reconstructed = serializeCarrier({ title: parentUri, fields: parentFields, text: "" }, children);
        }
      } else {
        // No raw text (new carrier) — reconstruct from all sibling children.
        const childTitles: string[] = this.tw5.filterTiddlers(`[tag[${parentUri}]has[ahu-slot]]`);
        const children = childTitles.map((ct) => {
          const ct5 = wiki.getTiddler?.(ct);
          const cf  = ct5?.fields ?? {};
          return {
            title: ct,
            fields: { ...cf, "ahu-slot": cf["ahu-slot"] ?? "", "ahu-parent": parentUri, tags: [parentUri] },
            text: String(cf["text"] ?? ""),
          };
        });
        reconstructed = serializeCarrier({ title: parentUri, fields: parentFields, text: "" }, children);
      }

      this._revisions.set(parentUri, revision);
      const record: LarTiddlerRecord = {
        title: parentUri,
        fields: Object.fromEntries(
          Object.entries(parentFields)
            .filter(([k]) => k !== "text" && k !== "title")
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(" ") : String(v)])
        ),
        text: reconstructed,
        revision,
        bag: "room",
      };
      await this.store.put(record, origin);
    },
  };

  private _inferChildCarrierTitle(title: string): { parentUri: string; slot: string } | null {
    const wiki = this.tw5.wiki;
    const tiddler = wiki.getTiddler?.(title);
    const fields = tiddler?.fields ?? {};

    const explicitParent = fields["ahu-parent"];
    if (typeof explicitParent === "string" && explicitParent) {
      const explicitSlot = fields["ahu-slot"];
      const slot = typeof explicitSlot === "string" && explicitSlot
        ? explicitSlot
        : (title.startsWith(explicitParent) ? title.slice(explicitParent.length) : "");
      if (slot) return { parentUri: explicitParent, slot };
    }

    // If TW5 has already removed the child tiddler, infer the parent from the
    // fragment title and only accept it when the parent tiddler is still local.
    // This avoids tombstoning derived child titles while still allowing direct
    // lar: titles containing "#" to be deleted when no parent carrier exists.
    const hash = title.lastIndexOf("#");
    if (!title.startsWith("lar:") || hash < 0) return null;
    const parentUri = title.slice(0, hash);
    const slot = title.slice(hash);
    if (!parentUri || !slot) return null;
    if (!wiki.getTiddler?.(parentUri)) return null;
    return { parentUri, slot };
  }

  private _carrierChildren(parentUri: string, excludeTitle?: string) {
    const wiki = this.tw5.wiki;
    const childTitles: string[] = this.tw5.filterTiddlers(`[tag[${parentUri}]has[ahu-slot]]`);
    return childTitles
      .filter((ct) => ct !== excludeTitle)
      .map((ct) => {
        const ct5 = wiki.getTiddler?.(ct);
        const cf  = ct5?.fields ?? {};
        return {
          title: ct,
          fields: { ...cf, "ahu-slot": cf["ahu-slot"] ?? "", "ahu-parent": parentUri, tags: [parentUri] },
          text: String(cf["text"] ?? ""),
        };
      });
  }

  private async _saveParentAfterChildDelete(
    childTitle: string,
    parentUri: string,
    slot: string,
    revision: string,
    origin: ChangeOrigin,
  ): Promise<void> {
    const wiki = this.tw5.wiki;
    const parentTiddler = wiki.getTiddler?.(parentUri);
    const parentFields: Record<string, string | string[]> = parentTiddler?.fields ?? {};
    const rawCarrierText: string = String(parentFields["text"] ?? "");

    let reconstructed = rawCarrierText ? removeCarrierSlot(rawCarrierText, slot) : null;
    if (reconstructed === null) {
      // Slot not found in raw text — full reconstruct from the remaining sibling
      // children. This is lossy, but preferable to writing a child tombstone.
      reconstructed = serializeCarrier(
        { title: parentUri, fields: parentFields, text: "" },
        this._carrierChildren(parentUri, childTitle),
      );
    }

    this._revisions.set(parentUri, revision);
    const record: LarTiddlerRecord = {
      title: parentUri,
      fields: Object.fromEntries(
        Object.entries(parentFields)
          .filter(([k]) => k !== "text" && k !== "title")
          .map(([k, v]) => [k, Array.isArray(v) ? v.join(" ") : String(v)])
      ),
      text: reconstructed,
      revision,
      bag: "room",
    };
    await this.store.put(record, origin);
  }

  private _removeLocalCarrierChildren(parentUri: string, origin: ChangeOrigin): void {
    const childTitles: string[] = this.tw5.filterTiddlers(`[tag[${parentUri}]has[ahu-slot]]`);
    if (childTitles.length === 0) return;
    const previous = this._applying;
    this._applying = origin;
    try {
      for (const title of childTitles) this.tw5.removeTiddler(title);
    } finally {
      this._applying = previous;
    }
  }

  deleteTiddler(
    title: string,
    callback: (err: Error | null) => void,
    _options?: unknown,
  ): void {
    // Echo-loop guard.
    if (this._applying !== null) { callback(null); return; }
    // Draft guard + lar: enforcement — only canonical lar: tiddlers reach the store.
    if (isSessionLocal(title) || isTW5System(title) || !title.startsWith("lar:")) { callback(null); return; }

    const origin: ChangeOrigin = { kind: "tw-local", instanceId: this.instanceId };
    const revision = String(Date.now());
    const childCarrier = this._inferChildCarrierTitle(title);

    if (childCarrier) {
      this._saveParentAfterChildDelete(title, childCarrier.parentUri, childCarrier.slot, revision, origin)
        .then(() => callback(null))
        .catch(callback);
      return;
    }

    this.store.tombstone(title, origin)
      .then(() => {
        if (title.startsWith("lar:")) this._removeLocalCarrierChildren(title, origin);
        callback(null);
      })
      .catch(callback);
  }

  getUpdatedTiddlers(
    _syncer: unknown,
    callback: (err: Error | null, updates: { modifications: string[]; deletions: string[] }) => void,
  ): void {
    const modifications = [...this._pendingModifications];
    const deletions = [...this._pendingDeletions];
    this._pendingModifications.clear();
    this._pendingDeletions.clear();
    callback(null, { modifications, deletions });
  }
}
