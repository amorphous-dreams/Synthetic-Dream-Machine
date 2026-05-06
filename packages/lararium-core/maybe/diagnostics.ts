export type Severity = "info" | "warning" | "error";

export interface Diagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: Severity;
}

export function makeDiagnostic(code: string, message: string, severity: Severity = "error"): Diagnostic {
  return { code, message, severity };
}
