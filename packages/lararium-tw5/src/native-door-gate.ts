/**
 * native-door-gate — the pure law the native `PUT /recipes/default/tiddlers/:title` skin applies
 * before the stock route lands the body. Reads the TiddlyWeb JSON once, answers either a refusal
 * (status + JSON body) or the body stock may land.
 *
 * THE ENVELOPE LAW. A top-level `bag` naming the host's anchor reads as TiddlyWeb's envelope — the
 * stamp `get-tiddler.js` lays over every record it serves — never as the author's field. It never
 * lands; the standing record's own `bag` rides through the save. A `bag` of any other value lands as
 * written. A body that fails to parse passes through untouched: stock answers it as stock does.
 */

export type NativeDoorReply =
  | { readonly kind: "refuse"; readonly status: number; readonly body: Record<string, unknown> }
  | { readonly kind: "pass"; readonly data: string };

export function nativeDoorGate(
  data: string,
  standing: Record<string, unknown> | undefined,
  anchor: string,
): NativeDoorReply {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { kind: "pass", data };
    body = parsed as Record<string, unknown>;
  } catch {
    return { kind: "pass", data };
  }
  // The envelope rides TOP-LEVEL alone (a known TiddlyWeb field); a nested `fields.bag` is always the author's.
  if (body["bag"] === anchor) {
    const next: Record<string, unknown> = { ...body };
    delete next["bag"];
    const own = standing?.["bag"];
    if (typeof own === "string") next["bag"] = own;
    return { kind: "pass", data: JSON.stringify(next) };
  }
  return { kind: "pass", data };
}
