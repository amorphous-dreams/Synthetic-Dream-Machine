"""Actual workflow: discover -> pet-name -> regrow -> o-takiage."""
from pathlib import Path
import json

from projection_loom.cli import main
from projection_loom.pipeline import Project
from projection_loom.evolution import Evolution
from projection_loom.relations import PetNameLedger

EXAMPLE=Path(__file__).parents[1]/'examples'/'emergent'/'project.json'


def test_cli_relational_workflow_and_production_receipt(tmp_path):
    out=tmp_path/'observe'
    result=main(['discover','--project',str(EXAMPLE),'--out',str(out)])
    assert result['nameless']==3
    assert (out/'relations.json').exists()
    ledger=tmp_path/'names.json'
    main(['pet-name','--witness',str(out/'relations.json'),'--ledger',str(ledger),
          '--target','~p-0003','--name','Wild Bridge','--has','bridge'])
    main(['pet-name','--witness',str(out/'relations.json'),'--ledger',str(ledger),
          '--target','foundation','--name','Unfinished Place','--mode','location',
          '--has','bridge','--has','portal'])
    grown=tmp_path/'grown'
    exported=main(['grow','--project',str(EXAMPLE),'--out',str(grown),
                   '--identity-ledger',str(ledger),'--export-size','160','220'])
    assert exported['contacts']['valid']
    receipt=json.loads((grown/'pet_name_receipt.json').read_text())
    assert len(receipt['resolutions'])==2
    assert all(r['status']=='matched' for r in receipt['resolutions'])
    assert (grown/'relations.json').exists()
    before=json.loads(ledger.read_text())
    released=main(['o-takiage','--ledger',str(ledger),'--branch','~p-0003',
                   '--witness',str(out/'relations.json')])
    assert released['released']
    assert released['softened_locations']
    after=json.loads(ledger.read_text())
    assert len(after['history'])==len(before['history'])+1
    assert sum(c['active'] for c in after['claims'])==1


def test_pet_name_affinity_enters_evolution_and_falls_away_after_release():
    project=Project.load(EXAMPLE)
    witness=project.grow().relation_witness(location=project.location)
    ledger=PetNameLedger(location=project.location)
    ledger.pet_name('Wild Bridge','~p-0003',witness,has=['bridge'],retain=1.)
    engine=Evolution(project,size=(72,96),seed=11,ledger=ledger)
    engine.evaluate([.15])
    before=engine.records[-1]
    assert before['valid'] and before['pet_name_soft_loss']>0
    ledger.o_takiage(name='Wild Bridge')
    engine_after=Evolution(project,size=(72,96),seed=11,ledger=ledger)
    engine_after.evaluate([.15])
    after=engine_after.records[-1]
    assert after['valid'] and after['pet_name_soft_loss']==0
    assert abs(before['loss']-after['loss']-.025)<1e-9
