/**
 * THE PLAIN SERVER'S SHORE — what the meme route skins stand on when a plain TiddlyWiki server
 * (the fork's `--listen`) carries them. One law, inlined into each skin's bundle (the sandbox's web
 * globals ride the `host-globals` startup module, which runs before any route answers):
 *
 * THE CONTAINER LAW. A 1-wiki server holds ONE container, and `recipes/default` and `bags/default`
 * both name it (TiddlyWeb's own stub). `default` names THE HOST'S ANCHOR — the one wiki here; @daemon
 * on a lares island — and any other recipe or bag is a name the server cannot resolve. A bag the
 * server cannot name MUST NOT swallow a write, so the skins answer 404 with a one-line body before
 * the path is read.
 *
 * THE DIGEST PAIR. A response that carries a canonical hash carries it twice: `ETag` (the house's
 * `sha256:hex`, the merge base a writer hands back as `If-Match`) and `Repr-Digest` (RFC 9530,
 * `sha-256=:<base64>:`, the standard field a client verifies the body against). One digest, two
 * spellings; `digestsEqual` reads either.
 */

import { reprDigestOf } from "@lararium/mesh/agile-digest";

/** The one container name a plain server resolves. */
export const HOST_ANCHOR = "default";

/** The refusal for a container the server cannot name, or null when `default` is named. A skin that
 *  addresses one container kind alone (DELETE writes a BAG, as stock's `delete-tiddler.js` does) names
 *  it in `kinds`; the other kind then reads as a container the skin cannot resolve. */
export function containerRefusal(params: readonly string[], kinds: readonly string[] = ["recipes", "bags"]): string | null {
  const [kind, name] = params;
  if (kind === undefined || !kinds.includes(kind)) return `no route under /${kind ?? ""}/ (this skin addresses /${kinds.join("/ and /")}/ alone)`;
  if (name === HOST_ANCHOR) return null;
  return `no such ${kind === "recipes" ? "recipe" : "bag"}: ${name ?? ""} (this server names only ${HOST_ANCHOR})`;
}

/** Answer a refused container: 404 with the one-line body. */
export function refuseContainer(response: { writeHead(status: number, headers: Record<string, string>): void; end(body?: string): void }, body: string): void {
  response.writeHead(404, { "Content-Type": "text/plain" });
  response.end(body);
}


/** The `ETag` + `Repr-Digest` pair for a canonical hash; empty where no hash stands (a refusal). */
export function digestHeaders(canonicalHash: string | undefined): Record<string, string> {
  if (!canonicalHash) return {};
  return { "ETag": `"${canonicalHash}"`, "Repr-Digest": reprDigestOf(canonicalHash) };
}
