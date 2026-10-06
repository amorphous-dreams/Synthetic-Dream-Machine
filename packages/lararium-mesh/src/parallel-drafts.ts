/**
 * parallel-drafts — Talk-Story conflict SURFACING over one bag's Automerge doc.
 *
 * A record merge assigns whole fields, so two actors who set one field concurrently resolve by
 * Automerge's deterministic last-writer-wins: one value reads live and the other survives only as a
 * conflict op. This module reads those ops (`getConflicts`) and answers every concurrent value as an
 * ATTRIBUTED PARALLEL DRAFT in TW5's own draft shape — `Draft of '<title>' by <who>`, carrying
 * `draft.of` / `draft.title` — so the losing edit stays reachable beside the winner.
 *
 * It detects and records; it never decides (residency-model #/conflict-resolution). The live value
 * stays exactly what the CRDT merged; nothing here writes, refuses, or picks. The operators — or
 * their agents, through Talk Story — read the drafts and author the resolving edit.
 *
 * A draft's fields:
 *   - every field of the live record, overlaid with THIS actor's value for each conflicted field
 *     (a whole-record conflict — two actors creating one title concurrently — takes the actor's whole
 *     record instead);
 *   - `lar-conflict-actor`  — the Automerge actor that wrote these values;
 *   - `lar-conflict-fields` — the conflicted field names, space-separated (`*` for a whole record);
 *   - `lar-conflict-live`   — `yes` when every conflicted value of this actor is the one reading live.
 * `<who>` reads the actor's own `modifier` value when it wrote one, else the actor id; two drafts that
 * would share a `<who>` both carry the actor prefix, so a title never names two drafts.
 */

import { getConflicts } from "@automerge/automerge";
import type { LarTiddlerRecord } from "./tiddler-store.js";

/** What a doc store raises when a change leaves concurrent values standing on a record. */
export interface ParallelDraftsChange {
  readonly title:  string;
  readonly bag:    string | undefined;
  readonly drafts: readonly LarTiddlerRecord[];
}

/** The draft title TW5 itself mints for a user's draft — the shape canon names for a parallel draft. */
export function parallelDraftTitle(title: string, who: string): string {
  return `Draft of '${title}' by ${who}`;
}

type Conflicts = Record<string, unknown> | undefined;

/** `counter@actor` → actor. */
function actorOf(opId: string): string {
  const at = opId.indexOf("@");
  return at < 0 ? opId : opId.slice(at + 1);
}

/** A plain copy of a conflict value — Automerge hands back live proxies for maps and lists. */
function plain(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Read every concurrent value standing on `tiddlers[title]` and answer one draft per writing actor.
 * Empty when the record carries no conflict. `tiddlers` is the doc's `tiddlers` map as Automerge
 * hands it out (a doc proxy, so `getConflicts` can read its ops).
 */
export function readParallelDrafts(tiddlers: unknown, title: string): LarTiddlerRecord[] {
  if (!tiddlers || typeof tiddlers !== "object") return [];
  const map = tiddlers as Record<string, { tiddler?: Record<string, unknown> } | undefined>;
  const record = map[title];
  if (!record) return [];

  type Draft = { actor: string; fields: Record<string, unknown>; conflicted: string[]; live: boolean };
  const byActor = new Map<string, Draft>();

  // A whole-record conflict: two actors created this title concurrently, each map a separate value.
  const whole = getConflicts(map as never, title as never) as Conflicts;
  if (whole && Object.keys(whole).length > 1) {
    const liveRecord = plain(record);
    for (const [opId, value] of Object.entries(whole)) {
      const v = plain(value) as { tiddler?: Record<string, unknown> } | undefined;
      byActor.set(actorOf(opId), {
        actor: actorOf(opId),
        fields: { ...(v?.tiddler ?? {}) },
        conflicted: ["*"],
        live: same(v, liveRecord),
      });
    }
  } else if (record.tiddler && typeof record.tiddler === "object") {
    // Field conflicts: concurrent assignments to one field of one shared record.
    const tiddler = record.tiddler;
    const liveFields = plain(tiddler) as Record<string, unknown>;
    for (const field of Object.keys(liveFields)) {
      const ops = getConflicts(tiddler as never, field as never) as Conflicts;
      if (!ops || Object.keys(ops).length < 2) continue;
      // Concurrent writers who agree raise no draft: surfacing where nothing disagrees decides as
      // much as arbitrating where something does.
      const values = Object.values(ops).map(plain);
      if (values.every((v) => same(v, values[0]))) continue;
      for (const [opId, value] of Object.entries(ops)) {
        const actor = actorOf(opId);
        const draft = byActor.get(actor) ?? { actor, fields: { ...liveFields }, conflicted: [], live: true };
        const v = plain(value);
        draft.fields[field] = v;
        draft.conflicted.push(field);
        if (!same(v, liveFields[field])) draft.live = false;
        byActor.set(actor, draft);
      }
    }
  }
  if (byActor.size < 2) return [];

  const drafts = [...byActor.values()].sort((x, y) => (x.actor < y.actor ? -1 : x.actor > y.actor ? 1 : 0));
  const whoOf = (d: Draft): string => {
    const modifier = d.fields["modifier"];
    return typeof modifier === "string" && modifier !== "" ? modifier : d.actor;
  };
  const counts = new Map<string, number>();
  for (const d of drafts) counts.set(whoOf(d), (counts.get(whoOf(d)) ?? 0) + 1);

  return drafts.map((d) => {
    const named = whoOf(d);
    const who = (counts.get(named) ?? 0) > 1 && named !== d.actor ? `${named} @${d.actor.slice(0, 8)}` : named;
    return Object.freeze({
      tiddler: Object.freeze({
        ...d.fields,
        title: parallelDraftTitle(title, who),
        "draft.of": title,
        "draft.title": title,
        "lar-conflict-actor": d.actor,
        "lar-conflict-fields": d.conflicted.join(" "),
        "lar-conflict-live": d.live ? "yes" : "no",
      }),
    });
  });
}
