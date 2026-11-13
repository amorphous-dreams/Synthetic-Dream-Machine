/**
 * faulting-tab.worker — a planted tab that dies while its module loads, so browser-tab-custody proves its `ask` refuses by name
 * rather than waiting out the test's clock.
 */
throw new Error("planted: this tab faults at load");
