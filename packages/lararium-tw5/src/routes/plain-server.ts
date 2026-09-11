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
 */

/** The one container name a plain server resolves. */
export const HOST_ANCHOR = "default";

/** The refusal for a container the server cannot name, or null when `default` is named. */
export function containerRefusal(params: readonly string[]): string | null {
  const [kind, name] = params;
  if (name === HOST_ANCHOR) return null;
  return `no such ${kind === "recipes" ? "recipe" : "bag"}: ${name ?? ""} (this server names only ${HOST_ANCHOR})`;
}

/** Answer a refused container: 404 with the one-line body. */
export function refuseContainer(response: { writeHead(status: number, headers: Record<string, string>): void; end(body?: string): void }, body: string): void {
  response.writeHead(404, { "Content-Type": "text/plain" });
  response.end(body);
}

