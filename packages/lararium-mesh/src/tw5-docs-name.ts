/**
 * tw5-docs-name — THE TW5 DOCS LIBRARIES' NAMES REST RESERVED: one name, one relation. `tw5-docs` names the read-only library of
 * the vendored tw5.com edition and `tw5-dev` the read-only library of the vendored dev edition (`@lararium/tw5`
 * `tw5-docs-library`): TiddlyWiki5's own native docs, two wiki folders read whole as bags, the canon of a foreign house that no
 * hand here writes. No other store may stand under either name: a bag declared, a canon source dir, or a wiki minted at
 * `bags/tw5-docs` would stand a second store that `--recipe tw5-docs` silently shadows. So each door that stands a store refuses
 * the name `tw5-docs-reserved`, and every write door refuses it `tw5-docs-read-only`, by the slug (`tw5-docs`, `@tw5-docs`), the
 * bag uri (`bags/tw5-docs`) and the wiki uri with its slots, for each library alike.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/one-name-one-relation
 */
import { bagUri, wikiUri } from "./lar-uris.js";
import { VerbRefusal } from "./verb-refusal.js";

/** The tw5.com edition's library slug: `--recipe tw5-docs`. */
export const TW5_DOCS_SLUG = "tw5-docs";
/** The dev edition's library slug: `--recipe tw5-dev`. */
export const TW5_DEV_SLUG = "tw5-dev";
/** Both TW5 docs libraries' slugs, the tw5.com edition first. */
export const TW5_DOCS_SLUGS: readonly string[] = [TW5_DOCS_SLUG, TW5_DEV_SLUG];
/** The refusal a door that would stand a store under the library's name gives. */
export const TW5_DOCS_RESERVED = "tw5-docs-reserved";
/** The refusal every write door gives the library. */
export const TW5_DOCS_READ_ONLY = "tw5-docs-read-only";

/** True where a slug, a bag uri or a wiki uri (a slot of it among them) names one of the TW5 docs libraries. */
export function namesTw5Docs(name: string | null | undefined): boolean {
  if (typeof name !== "string") return false;
  const n = name.trim();
  return TW5_DOCS_SLUGS.some((slug) => {
    const wiki = wikiUri(slug);
    return n === slug || n === `@${slug}` || n === bagUri(slug) || n === wiki || n.startsWith(`${wiki}/`);
  });
}

/** Refuse a door that would stand a store under the library's name. */
export function refuseTw5DocsReserved(name: string | null | undefined, verb: string): void {
  if (namesTw5Docs(name)) throw new VerbRefusal(TW5_DOCS_RESERVED, `${TW5_DOCS_RESERVED}: ${verb} — "${String(name).trim()}" names a TW5 docs library (\`--recipe tw5-docs\`, the vendored tw5.com edition; \`--recipe tw5-dev\`, the vendored dev edition; both read-only), and no other bag or wiki stands under that name`);
}

/** Refuse a write that names the library, by its slug or its bag. */
export function refuseTw5DocsWrite(name: string | null | undefined, verb: string): void {
  if (namesTw5Docs(name)) throw new VerbRefusal(TW5_DOCS_READ_ONLY, `${TW5_DOCS_READ_ONLY}: ${verb} — a TW5 docs library (\`--recipe tw5-docs\`, the tw5.com edition; \`--recipe tw5-dev\`, the dev edition) reads and never takes a write`);
}
