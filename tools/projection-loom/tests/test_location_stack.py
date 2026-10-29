"""Known/neutral/null controls for a heterogeneous location evidence stack."""
import hashlib
import pytest
from projection_loom.location_stack import (
    Frame, Source, Element, Relation, RegistrationReceipt, LocationStack,
)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def one_image():
    l = LocationStack('ruin-1', 'The Nameless Gate')
    l.add_frame(Frame('image-frame', 'pixel', 'px'))
    l.add_source(Source('painting', 'single_image', digest('painting'), 'painting.png', 'image-frame'))
    l.add_element(Element('~p-1', 'unresolved_form', ('painting',), ('#has/gate',), 'inferred'))
    return l


def test_single_image_no_automatic_metric_scale():
    l=one_image(); a=l.audit()
    assert a['valid'] and a['verified_registrations']==0 and a['cad_bodies']==0


def test_compatible_multimodal_location_with_independent_bodies():
    l=one_image()
    l.add_frame(Frame('ground', 'geospatial3d', 'm', crs='EPSG:32610', vertical_datum='NAVD88'))
    l.add_frame(Frame('local', 'local3d', 'model_unit'))
    l.add_source(Source('dem1','dem',digest('dem'),'terrain.tif','ground'))
    l.add_source(Source('mesh1','photogrammetry_mesh',digest('mesh'),'survey.obj','local'))
    l.add_element(Element('hill','terrain',('dem1',),('#has/hillside',),'source'))
    l.add_element(Element('keep','cad_body',('mesh1',),('#has/fortress',),'inferred','keep-genome'))
    l.add_element(Element('gatehouse','cad_body',('painting',),('#has/gateway',),'inferred','gate-genome'))
    l.relate(Relation('hill','supports','keep','inferred',('dem1',)))
    assert l.audit()['cad_bodies']==2


def test_void_hint_not_claimed_as_cad_certainty():
    l=one_image()
    l.add_element(Element('maybe-stair','unresolved_form',('painting',),('#has/possible-stair',),'proposed'))
    assert l.audit()['elements']==2


def test_forbid_unanchored_registration_from_single_image():
    l=one_image().add_frame(Frame('local','local3d','m'))
    l.register(RegistrationReceipt('image-frame','local','manual pixel matching','verified',('painting',),0.1,'px'))
    with pytest.raises(ValueError, match='independent surveyed control'):
        l.audit()


def test_accept_verified_registration_with_control_and_residual():
    l=one_image().add_frame(Frame('local','local3d','m'))
    l.add_source(Source('marker','survey_control',digest('marker'),'markers.csv','local'))
    l.register(RegistrationReceipt('image-frame','local','landmark fit','verified',('marker',),0.48,'px'))
    assert l.audit()['verified_registrations']==1


def test_provisional_camera_registration_is_not_verified():
    l=one_image().add_frame(Frame('local','local3d','model_unit'))
    l.register(RegistrationReceipt('image-frame','local','visual estimate','provisional'))
    assert l.audit()['verified_registrations']==0


def test_dem_explicit_vertical_datum():
    with pytest.raises(ValueError,match='vertical datum'):
        Frame('geo','geospatial3d','m',crs='EPSG:4326')
    assert Frame('geo','geospatial3d','m',crs='EPSG:4326',vertical_datum='unknown').vertical_datum=='unknown'


def test_dem_must_not_be_only_pixel_frame():
    l=one_image()
    l.add_source(Source('terrain','dem',digest('terrain'),'terrain.tif','image-frame'))
    with pytest.raises(ValueError,match='pixel-only'):
        l.audit()


def test_original_digest_is_mandatory():
    with pytest.raises(ValueError,match='SHA256'):
        Source('photo','single_image','bad','photo.png','image-frame')


def test_rejected_dangling_terrain_relation():
    l=one_image().relate(Relation('~p-1','near','other'))
    with pytest.raises(ValueError, match='known elements'):
        l.audit()


def test_containment_cycles_rejected_but_other_cycles_allowed():
    l=one_image().add_element(Element('~p-2','unresolved_form'))
    l.relate(Relation('~p-1','contains','~p-2'))
    l.relate(Relation('~p-2','contains','~p-1'))
    with pytest.raises(ValueError,match='cycle'):
        l.audit()
    l2=one_image().add_element(Element('~p-2','unresolved_form'))
    l2.relate(Relation('~p-1','influences','~p-2')).relate(Relation('~p-2','influences','~p-1'))
    assert l2.audit()['valid']


def test_body_validity_audited_per_element_not_globally():
    from projection_loom.seed_adapters import SeedScene
    class Solid:
        def __init__(self, valid):self.valid=valid
        def audit(self, join=False):
            assert join is True
            return {'valid':self.valid,'union_valid':self.valid,
                    'union_solids':1 if self.valid else 2}
    l=one_image()
    l.add_element(Element('body-a','cad_body',(),(), 'proposed','A'))
    l.add_element(Element('body-b','cad_body',(),(), 'proposed','B'))
    assert SeedScene(l,{'A':Solid(True),'B':Solid(True)},()).audit()==('body-a','body-b')
    with pytest.raises(ValueError,match='body-b'):
        SeedScene(l,{'A':Solid(True),'B':Solid(False)},()).audit()


def test_snapshot_is_stable_and_includes_source_digests(tmp_path):
    l=one_image(); p=tmp_path/'evidence.json'
    l.save(p)
    import json
    result=json.loads(p.read_text())
    assert result['snapshot_sha256']==l.to_dict()['snapshot_sha256']
    assert result['sources'][0]['sha256']==digest('painting')


def test_source_level_relationship_requires_evidence():
    with pytest.raises(ValueError,match='source-attested'):
        Relation('A','supports','B',epistemic='source')


def test_text_note_does_not_invent_a_frame():
    l=one_image()
    l.add_source(Source('story','text_testimony',digest('story'),'story.txt',None))
    assert l.audit()['sources']==2


def test_real_cad_audits_two_disconnected_bodies_without_global_fusion():
    from projection_loom.seed_adapters import SeedScene
    from projection_loom.solid import SolidAssembly, box
    l = one_image()
    l.add_element(Element('tower-a', 'cad_body', (), (), 'proposed', 'tower-A'))
    l.add_element(Element('tower-b', 'cad_body', (), (), 'proposed', 'tower-B'))
    a = SolidAssembly().add('root-A', box((0, 0, 0), (2, 2, 2)), role='foundation')
    b = SolidAssembly().add('root-B', box((300, 0, 0), (2, 2, 2)), role='foundation')
    assert SeedScene(l,{'tower-A': a, 'tower-B': b},()).audit() == ('tower-a', 'tower-b')


def test_snapshot_roundtrip_and_corrupt_snapshot_rejected(tmp_path):
    l = one_image()
    l.relate(Relation('~p-1', 'suggests', '~p-1', 'proposed'))
    dest = tmp_path / 'location.json'
    l.save(dest)
    restored = LocationStack.load(dest)
    assert restored.to_dict() == l.to_dict()
    import json
    damaged = json.loads(dest.read_text())
    damaged['pet_name'] = 'A changed claim'
    with pytest.raises(ValueError, match='digest mismatch'):
        LocationStack.from_dict(damaged)


def test_ingest_actual_source_bytes(tmp_path):
    sample = tmp_path / 'image.png'
    sample.write_bytes(b'a real byte sequence')
    src = Source.from_file('photo', 'single_image', sample, 'px-frame')
    assert src.sha256 == hashlib.sha256(sample.read_bytes()).hexdigest()
    assert src.locator == str(sample)
