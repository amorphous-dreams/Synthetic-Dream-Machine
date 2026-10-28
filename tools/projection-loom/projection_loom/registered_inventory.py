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
    """One source ledger for all calibrated independent RGBA images and anchors."""
    rows=registered_views(adapters)
    if not rows or len(rows) < 2:
        raise ValueError("Independent calibrated multiview location requires two or more cameras")
    stack=LocationStack(location)
    stack.add_frame(Frame("authored-local3d", "local3d", "model_unit"))
    measured_sources={}
    for item in rows:
        seed_id=item["source_id"]
        reg=item["registration"]
        frame_id="pixel-"+seed_id[:24]
        frame=Frame(frame_id,"pixel","px")
        stack.add_frame(frame)
        image_source_id="source-"+seed_id[:24]
        stack.add_source(Source.from_file(
            image_source_id,"single_image",item["path"],frame_id))
        stack.add_element(Element("observation-"+seed_id[:24],"image_plane",
                                  witness_ids=(image_source_id,),epistemic="source"))
        control=Path(reg["control_file"]).resolve(strict=True)
        control_id="survey-"+reg["anchor_sha256"][:24]
        if control_id not in measured_sources:
            measured_sources[control_id]=str(control)
            stack.add_source(Source.from_file(
                control_id,"survey_control",control,"authored-local3d"))
        elif measured_sources[control_id]!=str(control):
            raise ValueError("One independent survey digest resolves to conflicting locators")
        calibration=Path(reg["calibration_file"]).resolve(strict=True)
        calibration_id="calibration-"+reg["calibration_sha256"][:24]
        if calibration_id in stack.sources:
            raise ValueError("Distinct image registrations collided at one camera identity")
        stack.add_source(Source.from_file(
            calibration_id,"text_testimony",calibration,None))
        stack.register(RegistrationReceipt(
            source_frame=frame_id,target_frame="authored-local3d",
            method="measured-perspective-PnP",
            state="verified",
            anchor_sources=(control_id,calibration_id),
            residual=float(reg["observed_rms_px"]),
            residual_units="px"))
    stack.audit()
    status=stack.verify_source_bytes()
    if any(v!="matched" for v in status.values()):
        raise ValueError("Registered source inventory includes unresolved remote evidence")
    return stack
