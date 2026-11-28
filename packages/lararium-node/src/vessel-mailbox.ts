/**
 * vessel-mailbox — the durable mailbox of the lane law (§7), keel-resident
 * and substrate-agnostic: node and browser vessels wire the same mechanism.
 *
 * The work snapshot retains pending payload, request identity and delivery state. A drain
 * records its claim before delivery and removes the row only after acknowledgement. Restart
 * retries the same request identity (at-least-once delivery); a receiving operation must use
 * that identity for any effect requiring deduplication across a lost acknowledgement.
 *
 * Lane law: this rides the merge seat. Nothing here touches workers or
 * ports — the caller supplies `placeVerb` (its own live-delivery path).
 */

import { VESSEL_WORK_ID } from "@lararium/mesh/lar-uris";
import { MAILBOX_URI_PREFIX } from "@lararium/mesh/verb-tiddler";
import { type CompositeStore } from "@lararium/mesh/composite-store";

const MAILBOX_PREFIX = MAILBOX_URI_PREFIX;

export interface MailboxVerb {
  readonly requestId?: string;
  readonly verb:        string;
  readonly args:        Record<string, unknown>;
  readonly requestedBy: string;
}

export interface DurableMailbox {
  /** Park a verb for a non-live island — durably, visibly, never silently. */
  park(wikiId: string, v: MailboxVerb): Promise<void>;
  /** Deliver every parked verb for this island; failures stay parked. */
  drain(wikiId: string): Promise<void>;
}

export function makeDurableMailbox(
  /** The durable vessel work capability. */
  composite: CompositeStore,
  placeVerb: (wikiId: string, v: MailboxVerb) => Promise<unknown>,
  log: (line: string) => void = () => {},
): DurableMailbox {
  const draining = new Map<string, Promise<void>>();
  const mailbox: DurableMailbox = {
    async park(wikiId, v): Promise<void> {
      const id = v.requestId ?? crypto.randomUUID();
      await composite.put({
        tiddler: {
          title: `${MAILBOX_PREFIX}${wikiId}/${id}`,
          "wiki-id": wikiId,
          "request-id": id,
          verb: v.verb,
          args: JSON.stringify(v.args),
          "requested-by": v.requestedBy,
          status: "parked",
          "parked-at": new Date().toISOString(),
        },
        meta: {},
      }, { kind: "lares-verb", requestId: id }, { bag: VESSEL_WORK_ID });
      log(`[mailbox] parked ${v.verb} for ${wikiId} (island not live)`);
    },

    async drain(wikiId): Promise<void> {
      const held = draining.get(wikiId); if (held) return held;
      const task = deliver(wikiId); draining.set(wikiId, task);
      try { await task; } finally { draining.delete(wikiId); }
    },
  };
  async function deliver(wikiId: string): Promise<void> {
      const prefix = `${MAILBOX_PREFIX}${wikiId}/`;
      const titles = (await composite.listVisible()).filter((t) => t.startsWith(prefix));
      for (const title of titles) {
        const rec = await composite.get(title);
        const f = rec?.tiddler as Record<string, string> | undefined;
        if (!rec || !f || !["parked", "delivering"].includes(f["status"] ?? "")) continue;
        try {
          const requestId = f["request-id"] ?? title.slice(prefix.length);
          await composite.put({ ...rec, tiddler: { ...rec.tiddler, status: "delivering" } }, { kind: "lares-verb", requestId });
          await placeVerb(wikiId, {
            requestId,
            verb: f["verb"]!,
            args: JSON.parse(f["args"] ?? "{}") as Record<string, unknown>,
            requestedBy: f["requested-by"] ?? "mailbox",
          });
          await composite.remove(title, { kind: "lares-verb", requestId: `${title}#delivered` });
          log(`[mailbox] delivered ${f["verb"]} to ${wikiId}`);
        } catch (cause) {
          log(`[mailbox] kept ${f["verb"]} for ${wikiId}: ${cause instanceof Error ? cause.message : String(cause)}; inspect the request, then drain again`);
        }
      }
  }
  return mailbox;
}
