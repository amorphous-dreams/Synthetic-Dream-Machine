"""Divergence diagnostics locate, but never accept, falsified source testimony."""
import pytest
from projection_loom.provenance_encoding import first_json_difference


def test_replay_diagnostic_reports_exact_first_path():
    original={"source":{"bodies":[{"size":[2.0,3.0,1.0]}]},"authority":False}
    changed={"source":{"bodies":[{"size":[2.0,4.0,1.0]}]},"authority":False}
    assert first_json_difference(original,changed)=="$.source.bodies[0].size[1]"
    assert first_json_difference(original,original) is None
    assert first_json_difference(original,{**original,"unexpected":1})=="$.unexpected (unexpected)"
    assert first_json_difference(original,{"authority":False})=="$.source (missing)"
    assert first_json_difference(original,{"source":{"bodies":[]},"authority":False})=="$.source.bodies (length)"
    assert first_json_difference([1,2],(1,2))=="$ (type)"
