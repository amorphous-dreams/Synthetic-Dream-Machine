"""Factual source/frame ledger for independently registered visual observations.

This adapter contributes source and frame testimony to one LocationStack.
Registration here means measured internal landmark consistency, *not*
certification of the external world coordinates or shape inference.
"""
from __future__ import annotations

from pathlib import Path
from .location_stack import (
    Element, Frame, LocationStack, RegistrationReceipt, Source)
from .seed_adapters import registered_views


def registered_location_inventory(adapters, location):
    """Reconcile measured source views through the canonical inventory owner."""
    return LocationStack.admit_registered_views(registered_views(adapters), location)
