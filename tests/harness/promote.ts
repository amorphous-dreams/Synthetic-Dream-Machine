import type { LarInstance } from "./instance.js";

/** Move each landed carrier family from a wiki working slot into its canon bag. */
export async function promoteLoadedTitles(
  lar: LarInstance,
  answer: unknown,
  slug: string,
): Promise<void> {
  const data = answer && typeof answer === "object" && !Array.isArray(answer)
    ? (answer as { data?: unknown }).data
    : undefined;
  const titles = Array.isArray(answer)
    ? answer.filter((title): title is string => typeof title === "string")
    : data && typeof data === "object" && Array.isArray((data as { titles?: unknown }).titles)
      ? (data as { titles: unknown[] }).titles.filter((title): title is string => typeof title === "string")
      : [];
  if (titles.length === 0) {
    throw new Error(`promotion refused: LOAD answer carries no landed titles: ${JSON.stringify(answer)}`);
  }
  const working = `lar:///ha.ka.ba/wikis/${slug}/working`;
  const canon = `lar:///ha.ka.ba/bags/${slug}`;
  const roots = titles.filter((title) =>
    !titles.some((candidate) => candidate !== title &&
      (title.startsWith(`${candidate}#`) || title.startsWith(`${candidate}/`))),
  );
  for (const title of roots) {
    const moved = await lar.cli([
      "act", "MOVE", "--title", title, "--from", working, "--to", canon, "--yes", "--json",
    ]);
    if (moved.json?.["ok"] !== true) {
      throw new Error(`promotion MOVE refused ${title}: ${JSON.stringify(moved.json ?? moved.stderr)}`);
    }
    const familySize = titles.filter((member) =>
      member === title || member.startsWith(`${title}#`) || member.startsWith(`${title}/`),
    ).length;
    const movedCount = Number((moved.json["data"] as { moved?: unknown } | undefined)?.moved ?? 0);
    if (movedCount < familySize) {
      throw new Error(`promotion MOVE ${title} carried ${movedCount} title(s), expected its ${familySize}-title family`);
    }
  }
}
