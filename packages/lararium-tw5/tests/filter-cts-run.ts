/**
 * The one way a filter-cts case runs against an engine: the case's context binds through TW5's own fake widget, and
 * an engine that answers a malformed filter with its "Filter error" result reads as the case's fault. The generator
 * that freezes the suite and the runner that diffs it both call this, so the frozen answer and the checked answer
 * come from one reading.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/goldens/filter-cts
 */
import type { TW5Engine } from "../src/tw5-vm.js";

export interface FilterCtsCase {
  readonly id: string;
  readonly filter: string;
  readonly context?: Record<string, string>;
  readonly tags: readonly string[];
  readonly since: string;
  readonly "host-bound": boolean;
}

export type FilterCtsAnswer = { readonly parse: unknown; readonly results: readonly string[] } | { readonly fault: string };

const FILTER_ERROR = /^Filter error:/;

export function runFilterCtsCase(engine: TW5Engine, test: Pick<FilterCtsCase, "filter" | "context">): FilterCtsAnswer {
  const tw = engine.$tw as unknown as { rootWidget: { makeFakeWidgetWithVariables(vars: Record<string, string>): unknown } };
  const widget = test.context ? tw.rootWidget.makeFakeWidgetWithVariables(test.context) : undefined;
  try {
    const parse = engine.wiki.parseFilter(test.filter);
    const results = engine.wiki.filterTiddlers(test.filter, widget as never);
    if (results.length === 1 && FILTER_ERROR.test(results[0]!)) return { fault: results[0]! };
    return { parse, results };
  } catch (error) {
    return { fault: error instanceof Error ? error.message : String(error) };
  }
}
