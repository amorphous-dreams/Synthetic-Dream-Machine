// TW5 header sentinel: files whose first line is exactly /*\  (4 chars: / * \ newline)
export const HEADER_START = "/*\\\n";

// Extracts the body between /*\ ... \*/  (uses RegExp ctor to avoid literal-escaping issues)
const HEADER_RE = new RegExp(String.raw`^/\*\\\n([\s\S]*?)\n\\\*/`, "m");

export interface Tw5Header {
  body: string;
  fields: Record<string, string>;
  banner: string;
}

export function parseTw5Header(src: string, absPath: string): Tw5Header | null {
  if (!src.startsWith(HEADER_START)) return null;
  const headerMatch = HEADER_RE.exec(src);
  if (!headerMatch) return null;
  const body = headerMatch[1]!;
  const fields = parseHeaderFields(body, absPath);
  validateHeaderFields(fields, absPath);
  return { body, fields, banner: HEADER_START + body + "\n\\*/\n" };
}

function parseHeaderFields(headerBody: string, absPath: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const [idx, rawLine] of headerBody.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Za-z0-9_.:-]+):\s*(.*)$/.exec(line);
    if (!match) {
      throw new Error(`[plugin-build] invalid TW5 header line ${idx + 2} in ${absPath}: ${rawLine}`);
    }
    const key = match[1]!;
    if (fields[key] !== undefined) {
      throw new Error(`[plugin-build] duplicate TW5 header field "${key}" in ${absPath}`);
    }
    fields[key] = match[2]!.trim();
  }
  return fields;
}

function validateHeaderFields(fields: Record<string, string>, absPath: string): void {
  const required = ["title", "type", "module-type"] as const;
  for (const key of required) {
    if (!fields[key]) throw new Error(`[plugin-build] /*\\ block missing ${key}: in ${absPath}`);
  }
  if (fields["type"] !== "application/javascript") {
    throw new Error(`[plugin-build] ${absPath} has type=${fields["type"]}; TW5 module sources must use application/javascript`);
  }
  const title = fields["title"]!;
  if (!title.startsWith("lar:///") && !title.startsWith("$:/")) {
    throw new Error(`[plugin-build] ${absPath} has non-canonical module title: ${title}`);
  }
}
