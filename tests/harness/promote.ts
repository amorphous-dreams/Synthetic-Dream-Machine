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
  const titleAnswer = data && typeof data === "object"
    ? (data as { titles?: unknown }).titles
    : undefined;
  if (titleAnswer && typeof titleAnswer === "object" && !Array.isArray(titleAnswer) &&
      typeof (titleAnswer as { boundedArrayCount?: unknown }).boundedArrayCount === "number") {
    throw new Error("the answer bounds its titles; promote a smaller LOAD");
  }
  const titles = Array.isArray(answer)
    ? answer.filter((title): title is string => typeof title === "string")
    : Array.isArray(titleAnswer)
      ? titleAnswer.filter((title): title is string => typeof title === "string")
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

/** Seed a user bag: load the carrier into the lares wiki's working layer, then COPY its root family into `bag`. A COPY from a slot rides the daemon's reach (a MOVE out of a slot would route into the wiki island, which reaches no deep bag). */
export async function seedUserBag(lar: { cli: (a: readonly string[]) => Promise<{ json: Record<string, unknown> | null; stdout: string; stderr: string }> }, file: string, bag: string): Promise<void> {
  const ld = await lar.cli(["act", "LOAD", "--source-uri", file, "--to", "lar:///ha.ka.ba/wikis/lares/working", "--yes", "--json"]);
  if (ld.json?.["ok"] !== true) throw new Error(`seed LOAD refused: ${JSON.stringify(ld.json)}`);
  const titles = (((ld.json["data"] as { titles?: string[] } | undefined)?.titles) ?? []);
  const roots = titles.filter((t) => !titles.some((c) => c !== t && (t.startsWith(`${c}#`) || t.startsWith(`${c}/`))));
  for (const title of roots) {
    const mv = await lar.cli(["act", "COPY", "--title", title, "--from", "lar:///ha.ka.ba/wikis/lares/working", "--to", bag, "--yes", "--json"]);
    if (mv.json?.["ok"] !== true) throw new Error(`seed COPY refused ${title}: ${JSON.stringify(mv.json)}`);
  }
}
