"""Both constructive frontends use exactly one durable OODA-HA journal."""
from projection_loom.fractal_ooda_ha import OODAHAJournal
from projection_loom.constructive_phases import open_child,close_child
import pytest


def test_shared_phase_helpers_preserve_sole_journal_parent_anchoring(tmp_path):
    journal=OODAHAJournal(tmp_path/"phase.json",identity={
        "location":"site","score_state":"native-only","run":"same-source"},
        initial={},autonomy=1.)
    epoch=open_child(journal,"location/e000",parent="location",scope="epoch",
                     evidence={"epoch":0},orient={"seed":"a"},
                     decide={"budget":1},act={"native":"STEP"})
    candidate=open_child(journal,epoch+"/c0",parent=epoch,scope="candidate",
                         evidence={"program":"a"},orient={"source":"hash"},
                         decide={"gate":"native"},act={"candidate":"c0"})
    assert journal.data["loops"][candidate]["parent"]==epoch
    assert journal.data["loops"][candidate]["parent_phase"]=="act"
    close_child(journal,candidate,aftermath={"status":"native-valid"})
    close_child(journal,epoch,aftermath={"admitted":1})
    reopened=OODAHAJournal(tmp_path/"phase.json",identity={
        "location":"site","score_state":"native-only","run":"same-source"},
        initial={},autonomy=1.)
    assert reopened.data==journal.data
    assert reopened.data["loops"][epoch]["phase"]=="closed"


def test_shared_phase_vocabulary_refuses_shadow_scope(tmp_path):
    journal=OODAHAJournal(tmp_path/"phase.json",identity={
        "location":"site","score_state":"native-only","run":"a"},
        initial={},autonomy=1.)
    with pytest.raises(ValueError,match="epoch or candidate"):
        open_child(journal,"ineligible",parent="location",scope="shadow-controller",
                   evidence={},orient={},decide={},act={})

def test_same_child_receipts_refuse_second_interpretation(tmp_path):
    journal=OODAHAJournal(tmp_path/"phase.json",identity={
        "location":"site","score_state":"native-only","run":"strict"},
        initial={},autonomy=1.)
    info={"parent":"location","scope":"epoch","evidence":{"source":"original"},
          "orient":{"seed":"a"},"decide":{"budget":1},"act":{"native":"STEP"}}
    open_child(journal,"location/a",**info)
    with pytest.raises(ValueError,match="collision"):
        open_child(journal,"location/a",**{**info,"evidence":{"source":"changed"}})
    assert journal.data["loops"]["location/a"]["receipts"]["observe"]=={"source":"original"}
