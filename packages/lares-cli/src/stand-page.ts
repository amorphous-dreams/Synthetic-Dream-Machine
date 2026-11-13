/**
 * `lares vessel stand --page` -- the explicit act that carries the desk's prepared Web root to the child daemon.
 *
 * The flag names inputs and declares nothing it was not asked to: the two LAR_PRONAOS_* values ride the child
 * environment only where the caller declared neither, and same origin rides it only where no origin stands
 * declared (env or config). A declared value is never overwritten. The composition in the node verifies the
 * bytes; this shore trusts nothing. With no built desk the environment stays as it was, the note names the cure,
 * and the node's NO PRONAOS SHORE notice stands.
 */

import type { PronaosDeskInputs } from "@lararium/node";

export interface StandPageEnv {
  readonly env: NodeJS.ProcessEnv;
  readonly note: string | null;
}

export function standPageEnv(
  base: NodeJS.ProcessEnv,
  desk: PronaosDeskInputs | null,
  declared: { readonly originDeclared: boolean },
): StandPageEnv {
  if (desk === null) {
    return { env: base, note: "--page found no built Web root with its receipt; run `pnpm build`, then stand again (the node's NO PRONAOS SHORE notice stands until then)" };
  }
  const env: NodeJS.ProcessEnv = { ...base };
  const declaredPage = base["LAR_PRONAOS_WEB_ROOT"] !== undefined || base["LAR_PRONAOS_ARTIFACT_RECORD"] !== undefined;
  if (!declaredPage) {
    env["LAR_PRONAOS_WEB_ROOT"] = desk.webRoot;
    env["LAR_PRONAOS_ARTIFACT_RECORD"] = desk.artifactRecord;
  }
  if (!declared.originDeclared && base["LAR_SAME_ORIGIN"] === undefined) env["LAR_SAME_ORIGIN"] = "true";
  return { env, note: null };
}
