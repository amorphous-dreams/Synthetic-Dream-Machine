/**
 * @deprecated web2-era — index builders dead. See indexes.web2.ts for the original.
 * Rebuild target: compileInterfaceIndex / compileInvariantIndex → MemeRecord (not CarrierRecord).
 *
 * URI helpers below have NO carrier dependency — they survive as-is.
 */

const LARES_CAPS_FILES = new Set(["AGENTS", "LARES", "README", "SESSION"]);

export function laresRelPathToLarUri(relPath: string): string {
  const withoutMd = relPath.endsWith(".md") ? relPath.slice(0, -3) : relPath;
  const parts = withoutMd.split("/");
  if (parts.length === 1 && parts[0] && LARES_CAPS_FILES.has(parts[0])) {
    return `lar:///ha.ka.ba/@lares/${parts[0]}`;
  }
  return "lar:///ha.ka.ba/@lares/" + withoutMd;
}

export function chapelRelPathToLarUri(relPath: string): string {
  const withoutMd = relPath.endsWith(".md") ? relPath.slice(0, -3) : relPath;
  return `lar:///${withoutMd}`;
}
