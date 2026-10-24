"""Author the current Necrospire compound recipe (no fetched third-party data)."""
from pathlib import Path
from hashlib import sha256
from projection_loom.pipeline import Project
from projection_loom.capability_stack import CapabilityRecipe

HERE=Path(__file__).resolve().parent

def make():
    project=Project.load(HERE.parent/'project.json')
    extras={
        'crystal.relief':(.0,.31,.14),
        'crystal.fracture':(.0,.26,.10),
        'crystal.wave':(3,15,7),
        'crystal.seed':(0,99,13),
        'crystal.guide':(0,.25,0),
        'join.enable':(0,1,.2),
        'join.relief':(0,.22,.06),
        'join.fracture':(0,.16,.05),
        'join.wave':(3,12,5),
        'join.seed':(0,99,11)
    }
    steps=[
      {'id':'crystal.cad','entity':'Crystal','operator':'cad','part':'obsidian needle', 'has':['#has/structural-cage']},
      {'id':'crystal.mesh','entity':'Crystal','operator':'cad-polymesh',
       'part':'obsidian needle','layer':'~crystal-surface','depends_on':['crystal.cad'],
       'params':{'relief':'crystal.relief','fracture':'crystal.fracture','wave':'crystal.wave',
                 'seed':'crystal.seed','guide':'crystal.guide'},
       'socket':'top-east','has':['#has/faceted',' #has/obsidian'.strip()]},
      {'id':'crystal.socket','entity':'Crystal','operator':'semantic-socket',
       'part':'obsidian needle','layer':'~crystal-surface','socket':'top-east',
       'depends_on':['crystal.mesh'],'has':['#has/protected-interface']},
      {'id':'join.cad','entity':'Joining','operator':'cad','part':'lower terrace','has':['#has/structural-interface']},
      {'id':'join.contact-crystal','entity':'Joining','operator':'cad-contact',
       'part':'lower terrace','socket':'obsidian needle','depends_on':['join.cad','crystal.cad']},
      {'id':'join.mesh','entity':'Joining','operator':'cad-polymesh','part':'lower terrace',
       'layer':'~transition-skin','depends_on':['join.cad'], 'activation':'join.enable',
       'socket':'top-east',
       'params':{'relief':'join.relief','fracture':'join.fracture','wave':'join.wave','seed':'join.seed'}},
      {'id':'join.socket','entity':'Joining','operator':'semantic-socket','part':'lower terrace',
       'layer':'~transition-skin','socket':'top-east','depends_on':['join.mesh']},
      {'id':'fortress.cad','entity':'Fortress','operator':'cad','part':'central keep',
       'has':['#has/rooms','#has/fortification']},
      {'id':'fortress.contact-join','entity':'Fortress','operator':'cad-contact',
       'part':'central keep','socket':'lower terrace',
       'depends_on':['fortress.cad','join.cad']}
    ]
    bounds={**project.bounds,**{k:(x[0],x[1]) for k,x in extras.items()}}
    initial={**project.initial,**{k:v[2] for k,v in extras.items()}}
    return CapabilityRecipe(location=project.location,
          pet_name='Necrospire: A Crystal Bearing a Fortress',steps=steps,
          bounds=bounds,initial=initial,cad_keys=tuple(project.initial),
          source_hashes={'image':sha256(project.reference.read_bytes()).hexdigest()})

if __name__=='__main__':
    make().save(HERE/'recipe.json')
