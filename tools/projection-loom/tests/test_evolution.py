import json
from pathlib import Path
import numpy as np
from PIL import Image
from projection_loom.evolution import Project,produce
from projection_loom.render import silhouette
from projection_loom.fitness import silhouette_score


EXAMPLE=Path(__file__).resolve().parents[1]/'examples'


def test_evolution_refeeds_existing_view(tmp_path):
    project=Project.load(EXAMPLE/'project.json')
    reference=project.build({'width':1.09,'height':.91,'reach':1.03})
    control=tmp_path/'reference.png'
    Image.fromarray(silhouette(reference,project.cameras['reference'],(64,96)),'L').resize((256,384)).save(control)
    result=produce(EXAMPLE/'project.json',tmp_path/'run',feedback=['reference='+str(control)],
                   cycles=2,burst=4,survivors=2,offspring=1,
                   resolution=(64,96),export_size=(128,192),rng_seed=71)
    assert result['evaluations']>=5
    assert result['final_loss']<=result['baseline_loss']+1e-8
    assert (tmp_path/'run'/'mesh.npz').exists()
    assert (tmp_path/'run'/'controls'/'front_silhouette.png').exists()
    assert len(result['cycles'])==2
    assert isinstance(result['contacts']['part_contact_count'],int)


def test_silhouette_metric_identity():
    x=np.zeros((32,32),bool)
    x[8:20,10:24]=True
    values=silhouette_score(x,x)
    assert values['iou']==1.
    assert values['value']>.99
