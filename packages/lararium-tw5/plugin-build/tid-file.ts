export interface ParsedTidFile {
  fields: Record<string, string>;
  body: string;
}

/**
 * Parse a single classic .tid file as TW5 source input for build provenance.
 * Fields occupy the header before the first blank line; body follows exactly
 * with repository line endings normalized to LF for stable hashing.
 */
export function parseTidFile(text: string, filePath: string): ParsedTidFile {
  const fields: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  const blankIdx = lines.findIndex((line) => line.trim() === "");
  const fieldLines = blankIdx === -1 ? lines : lines.slice(0, blankIdx);

  for (const [idx, line] of fieldLines.entries()) {
    if (line.trim() === "") break;
    const match = /^([^:\s][^:]*):\s*(.*)$/.exec(line);
    if (!match) throw new Error(`[plugin-build] invalid .tid field line ${idx + 1} in ${filePath}: ${line}`);
    fields[match[1]!.trim()] = match[2]!.trim();
  }

  return {
    fields,
    body: blankIdx === -1 ? "" : lines.slice(blankIdx + 1).join("\n"),
  };
}
