"""Compatibility import path for the single fractal OODA-HA controller.

The implementation moved to fractal-ooda-ha.py. The hyphen names the house
procedure rather than a Python identifier; importlib can load that filename
while this legacy import surface continues to serve existing callers.
No second controller, journal or phase machine lives in this module.
"""
from importlib import import_module as _load

_engine = _load('.fractal-ooda-ha', __package__)
for _symbol in dir(_engine):
    if not _symbol.startswith('__'):
        globals()[_symbol] = getattr(_engine, _symbol)
del _symbol, _engine, _load
