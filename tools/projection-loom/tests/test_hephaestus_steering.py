"""Operator steering uses the already-existing OODA-HA helm, not a shadow brain."""
import json
from pathlib import Path
import pytest

from projection_loom.fractal_ooda_ha import (
    OODAHAJournal, submit_control, single_runner)
from projection_loom.intent_evolution import fair_auditions


def candidates():
    return [{"id":"a", "emitter":"initial"},
            {"id":"b", "emitter":"topology"},
            {"id":"c", "emitter":"mutation"},
            {"id":"d", "emitter":"crossover"}]


def test_operator_preference_changes_only_fair_seat_order():
    offers=candidates()
    assert fair_auditions(offers,1)[0]["emitter"]=="crossover"
    assert fair_auditions(offers,1,preferred_emitter="mutation")[0]["emitter"]=="mutation"
    assert {r["emitter"] for r in fair_auditions(offers,4,preferred_emitter="mutation")}=={
        "initial","topology","mutation","crossover"}
    with pytest.raises(ValueError,match="Unknown structural emitter"):
        fair_auditions(offers,1,preferred_emitter="unsupported")


def test_existing_helm_accepts_attributable_preference_once(tmp_path):
    path=tmp_path/"session.json"
    journal=OODAHAJournal(path,identity={
        "location":"held-out-operator-site","score_state":"none","run":"native-test"},
        initial={},autonomy=1.)
    request=submit_control(path,"prefer-emitter",emitter="mutation")
    assert journal.poll()
    assert journal.data["policy"]["preferred_emitter"]=="mutation"
    assert list(journal.data["applied_controls"])==[request["id"]]
    assert journal.poll()
    assert len(journal.data["applied_controls"])==1
    command=next((tmp_path/"controls"/"inbox").glob("*.json"))
    document=json.loads(command.read_text())
    document["parameters"]["emitter"]="topology"
    command.write_text(json.dumps(document))
    with pytest.raises(ValueError,match="altered"):
        journal.poll()


def test_single_runner_lock_refuses_competing_session(tmp_path):
    with single_runner(tmp_path/"session.json"):
        with pytest.raises(RuntimeError,match="already has a runner"):
            with single_runner(tmp_path/"session.json"):
                raise AssertionError("Concurrent OODA-HA controller ran")
    with single_runner(tmp_path/"session.json"):
        pass


def test_invalid_emitter_never_enters_operator_inbox(tmp_path):
    path=tmp_path/"session.json"
    OODAHAJournal(path,identity={
        "location":"held-out-operator-site","score_state":"none","run":"native-test"},
        initial={},autonomy=1.)
    with pytest.raises(ValueError,match="known proposal emitter"):
        submit_control(path,"prefer-emitter",emitter="unsourced-magic")
    assert not list((tmp_path/"controls"/"inbox").glob("*.json")) if (
        tmp_path/"controls"/"inbox").exists() else True
