/**
 * secret-shapes — THE ONE SECRET-SHAPE SCAN: the strings no keep pushes (`lares rite keep`'s guard) and no house alert carries
 * out through the read door (`@lararium/tw5` `stay-home`, `redactSecretShapes`). One list, so a shape added here guards both.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tiddler-verbs
 */

/**
 * The secret-shaped strings no keep pushes, the same list the operator's claude-backup sync scans with: an Anthropic key, a
 * GitHub token, an AWS access key id, a Slack token. A PEM private key reads apart (`KEEP_KEY_HEADER`): its header alone
 * names no secret, and a transcript that discusses one names it in prose.
 */
export const KEEP_SECRET_PATTERN = /(sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{22,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|(?:aws_secret_access_key|secret_access_key|SecretAccessKey)["']?\s*[:=]\s*["']?[A-Za-z0-9/+]{40})/g;
/** A PGP private key block, header through END: no body test, since its armor names the secret by itself. */
export const PGP_PRIVATE_BLOCK = /-----BEGIN PGP PRIVATE KEY BLOCK-----[\s\S]{0,16384}?-----END PGP PRIVATE KEY BLOCK-----/g;
/**
 * A PEM private key's header. It trips the guard only where key material follows it: within `KEEP_KEY_BODY_LINES` lines,
 * before any END line, a run of body lines holding at least `KEEP_KEY_BODY_MIN` characters (a real key's body runs to
 * hundreds). The lines read through the carriages a file meets: real newlines, CRLF, and `\n` escaped once or more inside
 * JSONL; an encrypted PEM's header fields (`Proc-Type:`, `DEK-Info:`) and blank lines may stand before the body.
 *
 * A BODY LINE READS WHOLE: the entire trimmed line consists of base64 characters, reaches `KEEP_KEY_LINE_MIN` (OpenSSH and
 * PEM bodies wrap at 70 and 64), and holds an upper-case letter (random base64 that long always does; a hex digest, a
 * lower-case word or path never does). Only the run's last line may fall short, as a body's tail does. Anything else ends
 * the run: a path, prose, an identifier, or a short token after an escaped newline counts for nothing.
 */
export const KEEP_KEY_HEADER = /-----BEGIN [A-Z ]*PRIVATE KEY-----/g;
export const KEEP_KEY_BODY_MIN = 64;
export const KEEP_KEY_BODY_LINES = 64;
export const KEEP_KEY_LINE_MIN = 40;
const KEY_BODY_WINDOW = 16384;
const KEY_BREAK = /(?:\\+r)?\\+n|\r?\n|\r/g;
const KEY_BASE64_LINE = /^[A-Za-z0-9+/]+={0,2}$/;
const KEY_FIELD_LINE = /^(?:Proc-Type|DEK-Info): /;

/** Does key material follow a private-key header? `after` holds the text right after the header's closing dashes. */
function keyBodyFollows(after: string): boolean {
  const lines = after.slice(0, KEY_BODY_WINDOW).replace(/\\+\//g, "/").split(KEY_BREAK).slice(0, KEEP_KEY_BODY_LINES);
  let body = 0, started = false;
  for (const raw of lines) {
    // A body run on one line with its END: the base64 stops where the END line's dashes start.
    const line = raw.split("-----END ")[0]!.trim();
    const ends = raw.includes("-----END ");
    if (line === "" || (!started && KEY_FIELD_LINE.test(line))) { if (ends || started) break; continue; }
    if (!KEY_BASE64_LINE.test(line)) break;
    const full = line.length >= KEEP_KEY_LINE_MIN && /[A-Z]/.test(line);
    // A short line counts only as the tail of a run already started, and ends it.
    if (!full) { if (started) body += line.length; break; }
    started = true;
    body += line.length;
    if (ends) break;
  }
  return body >= KEEP_KEY_BODY_MIN;
}
/** Known fixtures a match may hold and still pass: the AWS documentation key, and the house's PLANTED test values. */
export const KEEP_SECRET_ALLOW: readonly string[] = ["AKIAIOSFODNN7EXAMPLE", "PLANTED"];

/**
 * The secret-shaped strings one text holds, the allowed fixtures dropped. A private-key header counts only where key material
 * follows it, and reads as the header without its closing dashes.
 */
export function secretShapes(text: string): string[] {
  // Each header reads its body inside the scan window alone, never a copy of the whole text behind it.
  const keys = [...text.matchAll(KEEP_KEY_HEADER)].filter((m) => keyBodyFollows(windowAfter(text, m.index + m[0].length))).map((m) => m[0].slice(0, -5));
  const pgp = [...text.matchAll(PGP_PRIVATE_BLOCK)].map(() => "-----BEGIN PGP PRIVATE KEY BLOCK");
  return [...keys, ...pgp, ...[...text.matchAll(KEEP_SECRET_PATTERN)].map((m) => m[0])].filter((m) => !KEEP_SECRET_ALLOW.some((a) => m.includes(a)));
}

/** The scan window after an offset: at most `KEY_BODY_WINDOW` characters, sliced before any scan reads them. */
function windowAfter(text: string, at: number): string {
  return text.slice(at, at + KEY_BODY_WINDOW);
}

/**
 * THE HEX A HOUSE MINT READS AS: 32 random bytes or more, bare (a face route's ref, a ward ticket, an invite token's `n` and
 * `y`). A digest the house names by its scheme (`sha256:`, `sha256-`, `ni:///sha-256;`, a path segment) stands: the guard
 * reads only a run no scheme, word or path joins.
 */
export const MINTED_HEX = /(?<![0-9A-Za-z:;\-_/.])[0-9a-fA-F]{64,}(?![0-9A-Za-z])/g;

/** What a redaction stands in place of each secret-shaped string. */
export const SECRET_REDACTED = "[redacted: secret-shaped]";

/** How a redaction reads: the fixtures it lets stand, and whether it takes the house's bare minted hex too. */
export interface RedactOptions {
  /** Fixtures a match may hold and still stand; the keep's list where absent. A read door passes none. */
  readonly allow?: readonly string[];
  /** Take every bare run of 64+ hex characters (`MINTED_HEX`): the read door's strict reading. */
  readonly mintedHex?: boolean;
  /** Take every private-key block, body test or none (a 32-wide wrap, a short body): the read door's strict reading. */
  readonly everyKeyBlock?: boolean;
}

/**
 * THE TEXT WITH EVERY SECRET SHAPE REDACTED, and how many it took out. A token reads redacted whole; a private key reads
 * redacted from its header through its END line (or the scan window, where none closes it), where its body follows it, or
 * always under `everyKeyBlock`; a PGP private block reads redacted whole. An allowed fixture stands. Text with no shape returns
 * unchanged, with a count of zero.
 */
export function redactSecretShapes(text: string, opts: RedactOptions = {}): { readonly text: string; readonly redacted: number } {
  const allow = opts.allow ?? KEEP_SECRET_ALLOW;
  let redacted = 0;
  const take = (): string => { redacted++; return SECRET_REDACTED; };
  const tokens = (piece: string): string => {
    let out = piece.replace(PGP_PRIVATE_BLOCK, take).replace(KEEP_SECRET_PATTERN, (m: string) => (allow.some((a) => m.includes(a)) ? m : take()));
    if (opts.mintedHex) out = out.replace(MINTED_HEX, take);
    return out;
  };
  let out = "", from = 0;
  for (const m of text.matchAll(KEEP_KEY_HEADER)) {
    const at = m.index, after = at + m[0].length;
    const window = windowAfter(text, after);
    if (at < from || (!opts.everyKeyBlock && !keyBodyFollows(window))) continue;
    const end = /-----END [A-Z ]*PRIVATE KEY-----/.exec(window);
    const to = end === null ? after + window.length : after + end.index + end[0].length;
    out += tokens(text.slice(from, at)) + take();
    from = to;
  }
  return { text: out + tokens(text.slice(from)), redacted };
}
