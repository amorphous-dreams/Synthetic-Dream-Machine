"""RED-first typed receipts: one display vocabulary, irreducible truth scopes."""
from hashlib import sha256

import pytest

from projection_loom.evidence_receipts import (
    CadAuditReceipt, PolygonSurfaceReceipt, SocketProximityReceipt,
    CompoundAuditReceipt, RegistrationEvidenceReceipt,
    OperatorPreferenceReceipt, CapabilityStepReceipt, presentation_envelope,
)
from projection_loom.location_stack import (
    Frame, Source, LocationStack, RegistrationReceipt,
)


CAD = {'valid': True, 'union_valid': True, 'union_solids': 1}
MESH = {'name': 'crystal', 'valid': True, 'watertight': True, 'triangles': 12,
        'scope': 'polygon-surface-only'}
SOCKET = {'name': 'crystal-tip', 'valid': True, 'mesh_to_cad_anchor': .01,
          'cad_point_to_brep': .02, 'tolerance': .05,
          'scope': 'interface-proximity-not-structural-fusion'}
COMPOUND = {'cad': CAD, 'cad_valid': True, 'layers': [MESH],
            'attachments': [SOCKET], 'composite_valid_for_render': True,
            'composite_cad_union_verified': False}


def test_cad_mesh_socket_and_compound_do_not_share_a_truth_scope():
    cad = CadAuditReceipt.from_native(CAD)
    mesh = PolygonSurfaceReceipt.from_native(MESH)
    socket = SocketProximityReceipt.from_native(SOCKET)
    compound = CompoundAuditReceipt.from_native(COMPOUND)
    assert cad.admitted and compound.render_admissible
    assert [presentation_envelope(x)['domain'] for x in (cad, mesh, socket, compound)] == [
        'cad-brep', 'polygon-surface', 'socket-proximity', 'compound-render']
    assert all('valid' not in presentation_envelope(x)
               for x in (cad, mesh, socket, compound))
    with pytest.raises(ValueError, match='CAD audit'):
        CadAuditReceipt.from_native(MESH)
    with pytest.raises(ValueError, match='Polygon audit scope'):
        PolygonSurfaceReceipt.from_native(CAD)
    with pytest.raises(ValueError, match='Unrecognized typed receipt'):
        presentation_envelope(COMPOUND)


def test_lying_compound_or_socket_cannot_claim_structural_fusion():
    with pytest.raises(ValueError, match='cross-kernel fusion'):
        CompoundAuditReceipt.from_native({
            **COMPOUND, 'composite_cad_union_verified': True})
    with pytest.raises(ValueError, match='contradicts'):
        CompoundAuditReceipt.from_native({**COMPOUND, 'cad_valid': False})
    with pytest.raises(ValueError, match='contradicts'):
        CompoundAuditReceipt.from_native({
            **COMPOUND, 'layers': [{**MESH, 'valid': False}]})
    with pytest.raises(ValueError, match='tolerance'):
        CompoundAuditReceipt.from_native({
            **COMPOUND, 'attachments': [{**SOCKET, 'cad_point_to_brep': .15}]})
    with pytest.raises(ValueError, match='requires a boolean'):
        CadAuditReceipt.from_native({**CAD, 'valid': 1})


def test_nonfused_cad_does_not_earn_a_compound_render_gate():
    cad = CadAuditReceipt.from_native({**CAD, 'union_solids': 2})
    assert not cad.admitted
    view = CompoundAuditReceipt.from_native({
        **COMPOUND, 'cad': {**CAD, 'union_solids': 2}})
    assert not view.render_admissible


def test_registration_is_native_attached_and_still_not_survey_authenticity():
    stack = LocationStack('New Delos')
    stack.add_frame(Frame('painting', 'pixel', 'px'))
    stack.add_frame(Frame('survey-frame', 'local3d', 'm'))
    stack.add_source(Source('landmarks', 'survey_control', sha256(b'control').hexdigest(),
                            'control.csv', 'survey-frame'))
    native = RegistrationReceipt('painting', 'survey-frame', 'landmark fit',
                                 'verified', ('landmarks',), .1, 'px')
    stack.register(native)
    view = RegistrationEvidenceReceipt.from_location(stack, native)
    assert view.declared_state == 'verified'
    assert presentation_envelope(view) == {
        'domain': 'frame-registration',
        'status': 'fit-verified-not-survey-authenticity'}
    with pytest.raises(ValueError, match='not attached'):
        RegistrationEvidenceReceipt.from_location(LocationStack('other'), native)
    missing = LocationStack('unanchored').add_frame(Frame('painting','pixel','px'))
    missing.add_frame(Frame('survey-frame','local3d','m'))
    missing.register(native)
    with pytest.raises(ValueError, match='anchor'):
        RegistrationEvidenceReceipt.from_location(missing, native)


def test_operator_preference_cannot_become_a_geometry_or_source_witness():
    command = {'action': 'choose', 'actor': 'operator',
               'parameters': {'proposal_id': 'candidate-a'}}
    preference = OperatorPreferenceReceipt.from_control(command)
    assert presentation_envelope(preference) == {
        'domain': 'operator-preference', 'status': 'requested'}
    with pytest.raises(ValueError, match='operator authority'):
        OperatorPreferenceReceipt.from_control({**command, 'actor': 'adviser'})
    with pytest.raises(ValueError, match='Not an operator preference'):
        OperatorPreferenceReceipt.from_control({**command, 'action': 'pet-name'})
    with pytest.raises(ValueError, match='Malformed operator preference'):
        OperatorPreferenceReceipt.from_control({
            **command, 'parameters': {'proposal_id': ''}})


def test_capability_state_cannot_become_a_candidate_score_or_cad_proof():
    row = {'id': 'crystal.cage', 'entity': 'Crystal', 'operator': 'cad'}
    complete = CapabilityStepReceipt.from_native({
        **row, 'state': 'complete', 'output': {'kind': 'cad'}})
    assert presentation_envelope(complete) == {
        'domain': 'capability-execution', 'status': 'complete'}
    assert CapabilityStepReceipt.from_native({**row, 'state': 'inactive'}).state == 'inactive'
    assert CapabilityStepReceipt.from_native({
        **row, 'state': 'error', 'error': 'kernel refused'}).state == 'error'
    custom = CapabilityStepReceipt.from_native({
        **row, 'state': 'complete', 'output': {'custom': 4}})
    assert custom.output_kind is None
    with pytest.raises(ValueError, match='completed output'):
        CapabilityStepReceipt.from_native({
            **row, 'state': 'inactive', 'output': {'kind': 'cad'}})
    with pytest.raises(ValueError, match='Unknown capability step state'):
        CapabilityStepReceipt.from_native({
            **row, 'state': 'scored', 'output': {'kind': 'cad'}})
