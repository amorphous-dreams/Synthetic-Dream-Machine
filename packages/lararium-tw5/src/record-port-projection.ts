/** Pure field projection for the record port. A missing field and an omitted field carry different meanings. */
export type PortWidth = "full" | "skinny" | "story" | "none";
export interface PortShape {
  readonly width: PortWidth;
  readonly localFilter?: readonly string[];
  readonly fields?: readonly string[];
}
export interface PortRecord {
  readonly title: string;
  readonly seq?: number;
  readonly fields: Readonly<Record<string, unknown>>;
}
export interface ProjectedRecord extends PortRecord {
  readonly omitted: readonly string[];
}
const SKINNY = new Set(["tags", "modified", "type", "caption"]);

export function localFilter(title: string): boolean {
  return title === "$:/StoryList" || title === "$:/HistoryList" ||
    ["$:/state/", "$:/temp/", "$:/status/", "$:/info/browser/"].some(prefix => title.startsWith(prefix));
}

export function projectRecord(record: PortRecord, shape: PortShape): ProjectedRecord {
  const fields: Record<string, unknown> = {};
  const omitted: string[] = [];
  const selected = shape.width === "skinny" ? SKINNY :
    shape.width === "story" ? new Set(shape.fields ?? []) :
    shape.width === "none" ? new Set<string>() : null;
  for (const key of Object.keys(record.fields).sort()) {
    if (selected === null || selected.has(key)) fields[key] = record.fields[key];
    else omitted.push(key);
  }
  return { title: record.title, ...(record.seq === undefined ? {} : { seq: record.seq }), fields, omitted };
}

/** A load carries the record's revision, even if the caller asks for no existing fields. */
export function load(record: PortRecord, fields: readonly string[]): ProjectedRecord {
  const chosen: Record<string, unknown> = {};
  for (const key of fields) if (Object.hasOwn(record.fields, key)) chosen[key] = record.fields[key];
  return { title: record.title, ...(record.seq === undefined ? {} : { seq: record.seq }), fields: chosen, omitted: [] };
}

export function applyLoad(held: ProjectedRecord, loaded: ProjectedRecord): ProjectedRecord {
  if (held.title !== loaded.title || (held.seq ?? -1) > (loaded.seq ?? -1)) return held;
  const fields = { ...held.fields, ...loaded.fields };
  const seq = loaded.seq ?? held.seq;
  return { title: held.title, ...(seq === undefined ? {} : { seq }), fields,
    omitted: held.omitted.filter(key => !Object.hasOwn(loaded.fields, key)) };
}

/** Canonical JSON gives the same short identifier regardless of caller property order. */
export function shapeId(shape: PortShape): string {
  const canonical = JSON.stringify({ width: shape.width,
    localFilter: [...(shape.localFilter ?? [])].sort(), fields: [...(shape.fields ?? [])].sort() });
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
