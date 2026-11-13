/**
 * Whether a browser launch's refusal text names a missing host library, the one refusal the web config may answer by
 * dropping that engine. Two shapes carry it: Playwright's own "missing dependencies" report, and the dynamic loader's
 * "error while loading shared libraries" line that a headed shell prints when a system library is absent. A missing
 * executable or a broken install matches neither and keeps failing the run loud.
 */
export function refusalIsHostDependency(text: string): boolean {
  return /missing dependencies/i.test(text) || /error while loading shared libraries/i.test(text);
}
