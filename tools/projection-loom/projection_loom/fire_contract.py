"""Deterministic, standards-grounded compiler boundary for the current AI Fire.

Fire speaks memetic-wikitext / house Art Sigils with the Operator. It AUTHORS
a proposal JSON document; this module does not parse human language or invoke
a second model. Only validated, disambiguated proposals cross the boundary.

Graph structure: architectural edges may cycle, execution dependencies may not.
PROV-O names below are *conceptual mappings*, not a claim of RDF conformance.
"""
from __future__ import annotations
from pathlib import Path
import json
import re
import networkx as nx
from jsonschema import Draft202012Validator
from .provenance_encoding import canonical_json_sha256

SCHEMA = "projection-loom/fire-proposal"
PLAN_SCHEMA = "projection-loom/fire-bound-plan"
SOURCE = Path(__file__).resolve().parents[1] / "schemas" / "fire_proposal.schema.json"

ALLOWED = {
    "bridges": "bridge-between",
    "encircles": "ring-around",
    "bears": "bearing-column",
    "studies": "study-only",
}


def validate_proposal(value):
    """Validate machine binding, never execute arbitrary text from Inscription."""
    document = json.loads(json.dumps(value, allow_nan=False))
    validator = Draft202012Validator(json.loads(SOURCE.read_text()))
    errors = sorted(validator.iter_errors(document), key=lambda e: list(map(str, e.path)))
    if errors:
        error = errors[0]
        raise ValueError("Fire proposal contract: " + "/".join(map(str, error.path))
                         + ": " + error.message)
    if len({b["alias"] for b in document["bindings"]}) != len(document["bindings"]):
        raise ValueError("Fire proposal reuses an entity alias")
    if len({a["id"] for a in document["alternatives"]}) != len(document["alternatives"]):
        raise ValueError("Fire proposal duplicates an alternative")
    aliases = {b["alias"] for b in document["bindings"]}
    for row in document["alternatives"]:
        if row["subject"] not in aliases or row["object"] not in aliases:
            raise ValueError("Fire proposal references an undeclared entity alias")
        if row["subject"] == row["object"]:
            raise ValueError("Fire proposal may not construct a self-relation")
        if ALLOWED[row["relation"]] != row["implementation"]:
            raise ValueError("Fire proposal relation/implementation mismatch")
    if sum(len(x["text"]) for x in document["folio"]) > 6000:
        raise ValueError("Fire folio exceeds the house interpretation budget")
    return document


def resolve_proposal(document, witness, *, ledger=None, source_seed_sha256=None):
    """Resolve meaningful persistent selectors, never CAD face indices.

    Pet-names are operator claims from the external event-sourced ledger;
    the current Fire may not grant itself that authority.
    """
    value = validate_proposal(document)
    if value["source"]["location"] != witness.location:
        raise ValueError("Fire source location differs from the witness")
    if value["source"]["witness_id"] != witness.witness_id:
        raise ValueError("Fire source witness changed; repeat interpretation")
    declared = value["source"].get("seed_entity_sha256")
    if declared is not None and declared != source_seed_sha256:
        raise ValueError("Fire named seed identity changed")
    result = {}
    for binding in value["bindings"]:
        if "selector" in binding:
            hits = witness.locate(binding["selector"])
            if len(hits) != 1:
                raise ValueError("Fire selector is missing or ambiguous: "+binding["alias"])
            resolved = hits[0]
        else:
            if ledger is None or ledger.location != witness.location:
                raise ValueError("Pet-name binding requires a location-matched operator ledger")
            claims = {row["claim_id"]:row for row in ledger.claims
                      if row["active"] and row["name"] == binding["pet_name"]}
            if len(claims) != 1:
                raise ValueError("Pet-name needs exactly one live operator claim")
            observation = {row["claim_id"]:row for row in ledger.resolve(witness)}
            status = observation[next(iter(claims))]
            if status["status"] != "matched" or status["missing_has"]:
                raise ValueError("Pet-name relation is missing, drifted or unproven")
            resolved = status["handle"]
        if witness.nodes[resolved].kind == "location":
            raise ValueError("The whole location is not a material construction endpoint")
        result[binding["alias"]] = resolved
    edges = []
    for row in value["alternatives"]:
        subject, obj = result[row["subject"]], result[row["object"]]
        if subject == obj:
            raise ValueError("Fire aliases resolved to the same physical entity")
        if row["implementation"] != "study-only" and (
                witness.nodes[subject].kind != "material" or
                witness.nodes[obj].kind != "material"):
            raise ValueError("Native geometry relations require two material entities")
        edges.append((subject,obj,row["relation"],row["id"]))
    # Structural/architectural relations are allowed to cycle. This graph
    # is a witness of proposals, not an executable dependency DAG.
    graph = nx.MultiDiGraph()
    graph.add_nodes_from(result.values())
    for subject,obj,kind,identifier in edges:
        graph.add_edge(subject,obj,key=identifier,relation=kind)
    body = {
        "schema": PLAN_SCHEMA,
        "proposal_sha256": canonical_json_sha256(value),
        "source_witness_id": witness.witness_id,
        "seed_entity_sha256": source_seed_sha256,
        "location": witness.location,
        "resolved": dict(sorted(result.items())),
        "alternatives": value["alternatives"],
        "architectural_edges": [{"subject":s,"object":o,"relation":k,"id":i}
                                 for s,o,k,i in edges],
        "inscription": value["inscription"],
        "folio": value["folio"],
        "interpretation": value["intent"],
        "provenance": {"activity":"ai-fire-authored-proposal",
                       "used":[witness.witness_id,canonical_json_sha256(value)],
                       "attributed_in_input":value["intent"]["attribution"],
                       "claim":"proposed-only; no automatic operator promotion"},
        "authority": "candidate-only; never an approval receipt",
    }
    body["sha256"] = canonical_json_sha256(body)
    return body


def verify_plan(value):
    if value.get("schema") != PLAN_SCHEMA:
        raise ValueError("Not a typed Fire bound plan")
    if value.get("sha256") != canonical_json_sha256({k:v for k,v in value.items()
                                                     if k != "sha256"}):
        raise ValueError("Fire bound plan checksum mismatch")
    if not (isinstance(value.get("alternatives"),list) and
            isinstance(value.get("resolved"),dict)):
        raise ValueError("Fire bound plan incomplete")
    return value
