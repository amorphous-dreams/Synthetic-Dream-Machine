"""Diagnostics for the Lararium MCP carrier spine."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Severity = Literal["info", "warning", "error"]


@dataclass(frozen=True)
class Diagnostic:
    """A small, serializable compiler diagnostic."""

    code: str
    message: str
    severity: Severity = "error"

    def to_dict(self) -> dict[str, str]:
        return {
            "code": self.code,
            "message": self.message,
            "severity": self.severity,
        }
