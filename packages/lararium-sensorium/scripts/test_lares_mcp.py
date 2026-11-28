"""Phase-6a witness — lares_mcp: the isomorphic /mcp surface. The LaresCoordinator round-trips the
lifecycle verbs over a real ephemeral palace (pour->recall->status, kapae->recall-excludes->un_kapae-
restores); the MCPServer lists the five call-shape tools (get, put, delete, rename, act), each forwarding {verb, params}
to the vessel's `call`, and runs each act whose handler rests in the seat by its address (the isomorphism contract).

    PYTHONPATH=mempalace ./.venv/bin/python -m pytest packages/lararium-sensorium/scripts/test_lares_mcp.py -q
"""
import asyncio
import json
import os

import pytest

from lares_mcp import SENSE_HAND_VERBS, DaemonCoordinator, LaresCoordinator, build_mcp
from worldline_veil import veiled_root

_HERE = os.path.dirname(os.path.abspath(__file__))
_FIXTURE = os.path.join(_HERE, "fixtures", "capture", "claude-main.jsonl")
_CLI_VERBS = os.path.join(_HERE, "fixtures", "cli-verbs.json")

# The coordinator pour rides the shipping veil path (C1b) — pin a WITNESS salt for the whole module so
# every pour derives a DETERMINISTIC, portable worldline root (never the operator's on-disk persona key).
_SALT = "witness-lares-mcp-salt"


@pytest.fixture(autouse=True)
def _pin_worldline_salt(monkeypatch):
    monkeypatch.setenv("LAR_WORLDLINE_SALT", _SALT)


def _fake_embed():
    # a deterministic stand-in — the coordinator's real minilm is witnessed at Phase 2; here we test routing.
    return (lambda t: [float(len(t)), float(sum(map(ord, t[:8])) % 97)], "fake-model")


def _coord(tmp_path):
    return LaresCoordinator(str(tmp_path / ".mem"), wing="w", embed_factory=_fake_embed)


def test_coordinator_pour_recall_status(tmp_path):
    coord = _coord(tmp_path)
    res = coord.pour("claude", _FIXTURE, wing="w")
    assert res["landed"] >= 1                       # a real fixture captured through the driver
    hits = coord.recall("turn", 3)
    assert hits["matches"]                           # recall read-face returns turns
    assert coord.status()["total"] >= 1             # status reports what the sensorium holds


def test_recall_filters_by_the_block_taxonomy(tmp_path):
    # THE tension this whole ontology answers: the operator's steering recalls as its OWN stratum,
    # no longer fused into the agent's stream. speaker/channel/function narrow to one taxonomy axis.
    coord = _coord(tmp_path)
    coord.pour("claude", _FIXTURE, wing="w")
    op = coord.recall("engine", 20, speaker="operator")["matches"]
    assert op and all(m["metadata"].get("lar_speaker") == "operator" for m in op)   # steering, alone
    speech = coord.recall("engine", 20, channel="speech")["matches"]
    assert speech and all(m["metadata"].get("lar_channel") == "speech" for m in speech)  # the loud voices
    tool = coord.recall("Write", 20, channel="tool")["matches"]
    assert all(m["metadata"].get("lar_channel") == "tool" for m in tool)             # the tool traffic, apart
    everyone = {m["metadata"].get("lar_speaker") for m in coord.recall("the", 20)["matches"]}
    assert "operator" in everyone and "agent" in everyone   # unfiltered spans all — steering no longer drowns


def test_recall_pairs_blocks_into_exchanges(tmp_path):
    # the exchange-VIEW: a matched block recalls WITH its turn's siblings (steering beside surface),
    # the merge done as a read-time view — never baked into content.
    coord = _coord(tmp_path)
    coord.pour("claude", _FIXTURE, wing="w")
    out = coord.recall("engine", 8, pair=True)
    assert "exchanges" in out and out["exchanges"]                # grouped into turns, not bare blocks
    ex = next((e for e in out["exchanges"] if any(b["speaker"] == "operator" for b in e["blocks"])), None)
    assert ex is not None                                          # a turn headed by the operator surfaced
    speakers = [b["speaker"] for b in ex["blocks"]]
    assert "operator" in speakers and "agent" in speakers         # steering paired with the agent's stream
    idx = [b["chunk_index"] for b in ex["blocks"]]
    assert idx == sorted(idx)                                      # blocks ride in document order


def _live_turn_keys(coord):
    # the turn-keys RECALL surfaces (search excludes kapae-muted; taxonomy counts physical rows, so the
    # kapae contract reads through recall, not status).
    return {m["metadata"].get("lar_turn_key") for m in coord.recall("turn", 20)["matches"]}


def test_pour_refuses_unwired_shaping_args(tmp_path):
    # B2 footgun: writeback/dry_run ride the deferred cap-wire — they must REFUSE, never silently
    # ignore (dry_run=True would otherwise LAND for real on the append-only ground).
    #
    # `all` NO LONGER BELONGS HERE. It stopped refusing when it was wired onto the sweep spine
    # (lares_mcp.py:234 — "No refusal where the CLI works"), and this assertion was not updated, so
    # the loop below drove a REAL `sweep("all")` on every run. That sweep resolves
    # `session_discovery`'s HOME-rooted corpus, which on the operator's own box means 1912 claude
    # sessions + 146 codex, 1.6 GB, read and re-poured into a tmp palace — a guard that mined the
    # operator's entire chat history and read, from outside, as a hang. It never surfaced because
    # the whole file auto-marks `slow` and deselects by default. See `test_pour_all_routes_to_sweep`
    # below for the contract `all` actually carries now.
    coord = _coord(tmp_path)
    for kwargs in ({"writeback": True}, {"dry_run": True}):
        with pytest.raises(NotImplementedError):
            coord.pour("claude", _FIXTURE, **kwargs)


def test_pour_all_routes_to_sweep(tmp_path, monkeypatch):
    """`pour(all=True)` DELEGATES to the sweep spine — asserted at the seam, never by running it.

    Driving the real sweep here would walk the operator's actual `~/.claude` / `~/.codex` corpus,
    which is what the stale refusal assertion above was silently doing. The contract worth holding
    is the ROUTING: `all` reaches `sweep("all")` and carries wing and room through. Standing a
    recorder in sweep's place proves exactly that and touches no corpus at all.
    """
    coord = _coord(tmp_path)
    seen = {}
    monkeypatch.setattr(coord, "sweep",
                        lambda surface="all", **kw: (seen.update(surface=surface, **kw), {"ok": True})[1])
    out = coord.pour("claude", _FIXTURE, all=True, wing="w", room="conversations")
    assert out == {"ok": True}                       # the sweep's verdict rides back unwrapped
    assert seen["surface"] == "all"                  # every surface, not the named one
    assert seen["wing"] == "w" and seen["room"] == "conversations"


def test_coordinator_kapae_cascade_round_trip(tmp_path):
    coord = _coord(tmp_path)
    coord.pour("claude", _FIXTURE, wing="w")
    # bind the captured turns onto a worldline branch, then kapae it via the coordinator verb
    tks = sorted({m["metadata"].get("lar_turn_key") for m in coord.recall("turn", 8)["matches"]
                  if m["metadata"].get("lar_turn_key")})
    assert len(tks) >= 2
    coord._worldline.fork(tks[0], tks[1], 1)         # tks[1] rides a branch under tks[0]
    assert tks[1] in _live_turn_keys(coord)
    muted = coord.kapae(tks[1], 2)
    assert muted["muted_entries"] >= 1               # the branch's entries muted across the sensorium
    assert tks[1] not in _live_turn_keys(coord)      # recall now EXCLUDES the muted branch
    restored = coord.un_kapae(tks[1], 3)
    assert restored["restored_entries"] >= 1
    assert tks[1] in _live_turn_keys(coord)          # move-not-delete: un-kapae restores it to recall


def test_pour_builds_the_worldline_and_kapae_cascades_the_subtree(tmp_path):
    # THE CROWN (step-1): pour now rides capture_and_observe, so the fork-DAG BUILDS on the shipping
    # path — coordinator.worldline() returns the REAL braid (not empty). And kapae over a fork-root mutes
    # the whole SUBTREE across the sensorium (not just the named turn).
    coord = _coord(tmp_path)
    coord.pour("claude", _FIXTURE, wing="w")

    wl_dag = coord.worldline()
    assert wl_dag["edges"], "pour built no worldline — the observe leg never reached the entrypoint"
    # the fixture's main chain roots at the VEILED run (C1b) — `wl-<hash>` of the session basename, never
    # the bare "claude-main" in the clear (owner-recomputable under the pinned salt).
    run = veiled_root("claude-main", secret=_SALT.encode())
    assert run.startswith("wl-") and run in coord._worldline.roots()
    assert "claude-main" not in coord._worldline.roots()

    # a fork subtree: bind a child branch under a captured turn, then kapae the branch-ROOT — the whole
    # subtree mutes (root + its descendants), not one turn.
    tks = sorted({m["metadata"].get("lar_turn_key") for m in coord.recall("turn", 8)["matches"]
                  if m["metadata"].get("lar_turn_key")})
    assert len(tks) >= 2
    coord._worldline.fork(tks[0], tks[1], 100)          # tks[1] rides a branch under tks[0]
    assert set(coord._worldline.branch_keys(tks[0])) >= {tks[0], tks[1]}   # the subtree carries both
    muted = coord.kapae(tks[0], 101)                     # mute the branch-ROOT
    assert set(muted["branch"]) >= {tks[0], tks[1]}      # the cascade muted the WHOLE subtree
    live = _live_turn_keys(coord)
    assert tks[0] not in live and tks[1] not in live     # recall excludes the muted subtree
    coord.un_kapae(tks[0], 102)
    assert {tks[0], tks[1]} <= _live_turn_keys(coord)    # move-not-delete restores the subtree


SEAT_TOOLS = {"get", "put", "delete", "rename", "act"}

# The sensorium's own acts, each by the carrier that seats it (the vessel answers `handler/seat` for each).
SENSE_ACTS = ("lar:///sense.capture.pours", "lar:///sense.memory.recalls", "lar:///sense.taxonomy.counts",
              "lar:///sense.worldline.reads", "lar:///sense.kapae.mutes", "lar:///sense.kapae.restores",
              "lar:///sense.rhythm.analyzes", "lar:///sense.record.flows", "lar:///sense.plane.reads",
              "lar:///sense.roster.reads", "lar:///sense.pioneer.builds", "lar:///sense.source.reconciles")


def _mcp_tool_names(tmp_path):
    mcp = build_mcp(_coord(tmp_path))
    return {t.name for t in asyncio.run(mcp.list_tools())}


def test_the_seat_lists_exactly_the_record_tools_and_act(tmp_path):
    # RED on 421e4a4df^ (the landing-8 head): the seat listed its 32 hand-written tools (tiddler_get … reconcile).
    # GREEN on 421e4a4df: five tools, each one call shape; every other affordance rides `act` by its address.
    assert _mcp_tool_names(tmp_path) == SEAT_TOOLS


def test_no_hand_verb_holds_a_tool_or_a_seat_act_and_nothing_takes_an_approval_value(tmp_path):
    # THE HAND LAW (hitl-reads-a-hand): a person's hand at a real terminal approves a hand verb, and no value a seat fills
    # stands in for it, so no tool and no seat act carries one, and nothing the seat runs takes an `approve` value.
    import inspect
    mcp = build_mcp(_coord(tmp_path))
    tools = {t.name: t for t in asyncio.run(mcp.list_tools())}
    handlers = {getattr(fn, "__name__", "") for fn in mcp.seat_acts.values()}
    assert {"harden", "promote", "sense_harden", "sense_promote", "trust", "nexus_approve", "nexus_promote"}.isdisjoint(tools)
    for v in SENSE_HAND_VERBS:
        assert v.replace("-", "_") not in tools, f"hand verb {v!r} rides an MCP tool"
        assert v.replace("-", "_") not in handlers, f"hand verb {v!r} rides a seat act"
    for name, tool in tools.items():
        assert "approve" not in (tool.input_schema or {}).get("properties", {}), f"tool {name!r} takes an approval value a seat fills"
    for address, fn in mcp.seat_acts.items():
        assert "approve" not in inspect.signature(fn).parameters, f"seat act {address} takes an approval value a seat fills"


def test_the_sensorium_acts_seat_by_address(tmp_path):
    acts = build_mcp(_coord(tmp_path)).seat_acts
    for address in SENSE_ACTS:
        assert callable(acts.get(address)), f"no seat act holds {address}"


def test_recall_act_args_are_isomorphic_with_the_recall_api(tmp_path):
    """ARG-level isomorphism (2 surfaces, 1 API): the seat's recall act takes the same filter set as the
    LaresCoordinator.recall API the CLI also drives. A filter added to the coordinator but not the act
    (or vice versa) fails this loud, so the two surfaces can never silently drift. The CLI's
    --speaker/--channel/--function/--pair mirror the same names."""
    import inspect
    act = build_mcp(_coord(tmp_path)).seat_acts["lar:///sense.memory.recalls"]
    act_args = set(inspect.signature(act).parameters)
    api_args = set(inspect.signature(LaresCoordinator.recall).parameters) - {"self"}
    taxonomy = {"speaker", "channel", "function", "pair"}
    assert taxonomy <= act_args, "the recall act is missing a taxonomy filter"
    assert taxonomy <= api_args, "the recall API is missing a taxonomy filter"
    # the act mirrors the API and adds only `sensorium` (the router's which-sensorium key)
    assert act_args <= api_args | {"sensorium"}, "the recall act grew an arg the API cannot serve"


def test_parity_inventory_three_way(tmp_path):
    """THREE-WAY isomorphism guard against the CLI-verb INVENTORY (fixtures/cli-verbs.json). The seat's tools are the
    mirrored anchor and the `cli_forms` keys; each tool's CLI spelling lands on a real command, or on a call head the CLI
    reads outside its command table (`act`); every CLI command hosts a mirror XOR awaits one. Mutating any side (add an
    orphan tool, drop a mirrored word, split the inventory) fails this loud."""
    with open(_CLI_VERBS, encoding="utf-8") as f:
        inv = json.load(f)
    verbs = set(inv["verbs"])                    # all CLI top-level command names
    mirrored = set(inv["mirrored"])             # the seat's tool names (the anchor)
    mirror_hosts = set(inv["mirror_hosts"])     # the CLI commands those tools land on (coverage-form)
    call_heads = set(inv["call_heads"])         # the call heads the CLI reads outside its command table
    not_yet = set(inv["not_yet_mirrored"])
    cli_forms = inv["cli_forms"]
    tools = _mcp_tool_names(tmp_path)

    # (a) the seat's tool-set IS the mirrored anchor IS the cli_forms keys — grow a tool, grow all three.
    assert tools == mirrored == set(cli_forms)
    # (b) each tool's CLI spelling lands on a real command or a call head; a call head stands outside the command table.
    for m in tools:
        head = cli_forms[m].split()[0]
        assert head in mirror_hosts | call_heads, f"MCP {m!r} → CLI {cli_forms[m]!r} has no real host"
    assert mirror_hosts <= verbs and call_heads.isdisjoint(verbs)
    # (c) COVERAGE partition: every CLI top-level verb is a mirror-host XOR awaits.
    assert mirror_hosts | not_yet == verbs
    assert mirror_hosts.isdisjoint(not_yet)
    # (d) THE LOCAL-SEAT ALLOWANCE: a CLI sub-verb that runs over a file with no daemon holds NO seat by law. The fixture
    # names each one, its head lands on a real host, and no tool spells it.
    local_seat = set(inv["local_seat"])
    assert local_seat == {"meme normalize", "meme check"}
    for form in local_seat:
        assert form.split()[0] in verbs
        assert form not in cli_forms.values()
        assert form.replace(" ", "_") not in tools


def test_flow_seats_by_address_beside_its_own_cli_command(tmp_path):
    """The pet-named composed-flow surface — N flows behind one handler, never a handler per instrument: the seat runs it
    at lar:///sense.record.flows, and the CLI keeps its own top-level `flow` command."""
    assert callable(build_mcp(_coord(tmp_path)).seat_acts["lar:///sense.record.flows"])
    with open(_CLI_VERBS, encoding="utf-8") as f:
        inv = json.load(f)
    assert "flow" in inv["verbs"]


def test_meme_project_seats_by_address_and_the_target_rides_as_a_parameter(tmp_path):
    """The projection act at lar:///engine.meme.projects — the TARGET rides as a parameter (`to`), never a suffix on the
    verb, so ONE handler renders every target the island serves; no `carrier` command stands."""
    import inspect
    act = build_mcp(_coord(tmp_path)).seat_acts["lar:///engine.meme.projects"]
    assert "to" in inspect.signature(act).parameters
    with open(_CLI_VERBS, encoding="utf-8") as f:
        inv = json.load(f)
    assert "meme" in inv["verbs"]
    assert "carrier" not in inv["verbs"] and "project_md" not in inv["cli_forms"]


# ── the plane reads: `recall --lens structure/form` (folded) + the plane_record cross-plane witness ──


def _three_plane_bed(tmp_path):
    """A populated 3-plane palace in the TEST-BED layout (<root>/content|structure|form, one cid
    keying all three) — landed straight through the same stores plane_fanout composes, fixture-lite
    (two markdown records, hand-made form membership; no induction pass)."""
    import hashlib

    import content_io as cio
    from form_store import FormPalaceStore
    from structure_router import canonical_json, detect_kind, parse_to_tree, structural_hash
    from structurepalace_io import StructurePalaceStore

    root = str(tmp_path / "bed")
    embed_one, model = _fake_embed()
    content = cio.ContentStore(os.path.join(root, "content"), expected_dim=2, expected_model=model)
    structure = StructurePalaceStore(os.path.join(root, "structure"))
    form = FormPalaceStore(os.path.join(root, "form"))
    texts = {
        "alpha.md": "# Alpha\n\nfirst body\n",
        "beta.md": "# Beta\n\nsecond body\n\n- one\n- two\n",
    }
    cids, hashes = {}, {}
    memberships = {"alpha.md": {"indices": [0], "values": [1.0]},
                   "beta.md": {"indices": [0, 1], "values": [1.0, 1.0]}}
    for name, text in texts.items():
        cid = hashlib.sha256(text.encode()).hexdigest()
        cids[name] = cid
        content.put(cid, text, embed_one(text),
                    {"wing": "w", "room": "corpus", "source_file": name, "lar_embedder_model": model})
        tree = parse_to_tree(detect_kind(name, text), text)
        h = structural_hash(tree)
        hashes[name] = h
        structure.put(h, canonical_json(tree), source_file=name, verbatim_sha=cid)
        form.store(cid, memberships[name], 3, {"verbatim_sha": cid, "struct_hash": h})
    return root, cids, hashes


def _bed_coord(tmp_path):
    root, cids, hashes = _three_plane_bed(tmp_path)
    return LaresCoordinator(root, wing="w", embed_factory=_fake_embed), cids, hashes


def test_coordinator_resolves_the_three_plane_layout(tmp_path):
    # content lives at <root>/content in the test-bed layout — the coordinator reads it there
    # (never planting a second empty store at the root), so status counts the landed records.
    coord, cids, _ = _bed_coord(tmp_path)
    assert coord.status()["total"] == len(cids)


def test_recall_structure_answers_by_text(tmp_path):
    coord, _, hashes = _bed_coord(tmp_path)
    # a query of the SAME markdown shape as alpha.md (heading + paragraph) recalls its structural
    # entry nearest — the door rides the structural embedding, never the content vector.
    res = coord.recall_structure("# Gamma\n\nthird body\n", 2)
    assert res["present"] and res["matches"]
    assert res["matches"][0]["hash"] == hashes["alpha.md"]


def test_recall_structure_resolves_a_cid_through_provenance(tmp_path):
    coord, cids, hashes = _bed_coord(tmp_path)
    res = coord.recall_structure(cids["beta.md"], 4)
    assert res["present"] and res["entry"] is not None
    assert res["entry"]["hash"] == hashes["beta.md"]
    assert cids["beta.md"] in res["entry"]["provenance_cids"]


def test_recall_form_by_cid_with_neighbors(tmp_path):
    coord, cids, _ = _bed_coord(tmp_path)
    res = coord.recall_form(cids["alpha.md"], 3)
    assert res["present"] and res["record"] is not None
    assert res["record"]["dimension"] == 3
    assert res["record"]["active_templates"] == 1        # alpha carries one induced template
    neighbor_cids = [m["cid"] for m in res["matches"]]
    assert cids["alpha.md"] not in neighbor_cids          # self dropped
    assert cids["beta.md"] in neighbor_cids               # the other record rides nearest


def test_recall_form_text_query_answers_an_honest_null(tmp_path):
    coord, _, _ = _bed_coord(tmp_path)
    res = coord.recall_form("what shapes recur", 3)
    assert res["present"] and res["matches"] == [] and "note" in res


def test_plane_record_witnesses_all_three_planes(tmp_path):
    coord, cids, hashes = _bed_coord(tmp_path)
    rec = coord.plane_record(cids["alpha.md"])
    assert rec["content"]["present"] and rec["content"]["source_file"] == "alpha.md"
    assert rec["structure"]["present"] and rec["structure"]["hash"] == hashes["alpha.md"]
    assert rec["form"]["present"] and rec["form"]["active_templates"] == 1


def test_plane_record_honest_nulls_for_an_unknown_cid(tmp_path):
    coord, _, _ = _bed_coord(tmp_path)
    rec = coord.plane_record("f" * 64)
    assert not rec["content"]["present"]
    assert not rec["structure"]["present"]
    assert not rec["form"]["present"]


def test_plane_verbs_read_honest_nulls_without_plane_stores(tmp_path):
    # a plain capture palace (no structure/ or form/ store) answers present:false — the read
    # verbs never PLANT an empty plane palace.
    coord = _coord(tmp_path)
    assert coord.recall_structure("# Q\n\nbody\n", 2) == {
        "plane": "structure", "present": False, "matches": [],
        "note": "structure: this palace carries no structure store"}
    assert coord.recall_form("c" * 64, 2)["present"] is False
    assert not os.path.isdir(str(tmp_path / ".mem" / "structure"))


def test_cid_gate_carries_the_chunk_suffixed_form():
    # the live capture chunker keys records `<sha256>_<n>` — both the bare and the chunk-suffixed
    # form read as cids; prose (even hex-dense) reads as query text.
    from lares_mcp import _reads_as_cid
    assert _reads_as_cid("a" * 64)
    assert _reads_as_cid("a" * 64 + "_0")
    assert _reads_as_cid("a" * 64 + "_12")
    assert not _reads_as_cid("a" * 64 + "_x")
    assert not _reads_as_cid("a" * 63)
    assert not _reads_as_cid("what shapes recur across the corpus")


def test_recall_lens_folds_the_plane_reads(tmp_path):
    # the per-plane reads fold onto `recall --lens <plane>`: structure/form dispatch to the SAME plane
    # doors the direct methods drive — one surface, the bespoke reads unchanged.
    coord, cids, _ = _bed_coord(tmp_path)
    assert coord.recall("# Gamma\n\nthird body\n", 2, lens="structure") == \
        coord.recall_structure("# Gamma\n\nthird body\n", 2)
    assert coord.recall(cids["alpha.md"], 3, lens="form") == coord.recall_form(cids["alpha.md"], 3)
    # the default lens keeps the combined-arms content read
    assert "plane" not in coord.recall("body", 2)


def test_recall_unknown_lens_refuses(tmp_path):
    coord, _, _ = _bed_coord(tmp_path)
    with pytest.raises(ValueError):
        coord.recall("q", 2, lens="bogus")


def test_structure_query_face_carries_the_cross_plane_join(tmp_path):
    # the STORE now #has a clean query face (the coordinator stops reaching `_col`) — and each match
    # rides its `verbatim_sha`, the join key a cross-plane recall needs.
    coord, cids, hashes = _bed_coord(tmp_path)
    res = coord.recall_structure("# Gamma\n\nthird body\n", 2)
    assert res["present"] and res["matches"]
    top = res["matches"][0]
    assert top["hash"] == hashes["alpha.md"]
    assert top["verbatim_sha"] == cids["alpha.md"]


def test_recall_crossplane_widens_a_text_query_across_all_planes(tmp_path):
    # HUMAN-QUERY ALL PLANES: one text query → content hits, each WIDENED across form + structure by the
    # cross-plane cid-join (WITHOUT text-searching form/structure).
    coord, cids, hashes = _bed_coord(tmp_path)
    res = coord.recall_crossplane("body", 4)
    assert res["plane"] == "crossplane" and res["hits"]
    by_cid = {h["cid"]: h for h in res["hits"]}
    h = by_cid[cids["alpha.md"]]
    assert h["join_key"] == cids["alpha.md"]
    assert h["content"]["present"] and h["content"]["source_file"] == "alpha.md"
    assert h["structure"]["present"] and h["structure"]["hash"] == hashes["alpha.md"]
    assert h["form"]["present"] and h["form"]["active_templates"] == 1
    # the lens folds onto recall (isomorphic with the direct method)
    assert coord.recall("body", 4, lens="crossplane") == res


def test_recall_persistence_by_cid_neighbors_and_text_null(tmp_path):
    from persistence_io import PersistenceStore
    root = str(tmp_path / "bed")
    p = PersistenceStore(os.path.join(root, "persistence"))
    p.put("a" * 64, "ki", [1.0, 0.0], "signer", "frontier", {}, "finding one")
    p.put("b" * 64, "ki", [0.9, 0.1], "signer", "frontier", {}, "finding two")
    coord = LaresCoordinator(root, wing="w", embed_factory=_fake_embed)
    res = coord.recall_persistence("a" * 64, 3)
    assert res["present"] and res["record"]["kind"] == "ki"
    ncids = [m["cid"] for m in res["matches"]]
    assert ("b" * 64) in ncids and ("a" * 64) not in ncids     # neighbor rides, self dropped
    null = coord.recall_persistence("what earned standing", 3)
    assert null["present"] and null["matches"] == [] and "note" in null
    assert coord.recall("a" * 64, 3, lens="persistence") == res
    # honest null where the palace carries no persistence store
    assert _coord(tmp_path).recall("c" * 64, 2, lens="persistence")["present"] is False


def test_where_predicate_narrows_by_taxonomy():
    # the SPEAKER-stratum predicate: a filtered recall's `where` reads against the content metadata (the
    # projection owns none), so the projection leg narrows to the same stratum the content-vector does.
    from lares_mcp import _where_matches, _make_where_predicate
    assert _where_matches({"lar_speaker": "operator"}, {"lar_speaker": "operator"})
    assert not _where_matches({"lar_speaker": "agent"}, {"lar_speaker": "operator"})
    assert _where_matches({"a": 1, "b": 2}, {"$and": [{"a": 1}, {"b": 2}]})
    assert not _where_matches({"a": 1, "b": 3}, {"$and": [{"a": 1}, {"b": 2}]})

    class _FakeContent:
        def get(self, cid):
            return {"metadata": {"lar_speaker": "operator" if cid == "ok" else "agent"}}

    keep = _make_where_predicate(_FakeContent(), {"lar_speaker": "operator"})
    assert keep("ok") and not keep("no")
    assert _make_where_predicate(_FakeContent(), None) is None


def test_daemon_recall_plane_lens_owes_the_routing():
    # the routed read-holder threads the CONTENT lens today — a plane lens over the wire refuses,
    # naming the routing generalization rather than silently reading content.
    dc = DaemonCoordinator()
    with pytest.raises(RuntimeError):
        dc.recall("q", 2, lens="structure")


def test_daemon_pour_routes_to_the_capture_verb(monkeypatch):
    # pour rides the @daemon `capture` verb (the same verb `lares sense capture` drives) — the
    # routed surface REACHES the holder instead of `_owed`-refusing. Record the wire call to prove the
    # verb name + camelCase arg mapping without a live daemon.
    calls = []

    def _rec(verb, args):
        calls.append((verb, args))
        return {"landed": 1}

    monkeypatch.setattr("lares_mcp.uds.output", _rec)
    dc = DaemonCoordinator(wing="w")
    out = dc.pour("claude", "/x/claude-main.jsonl", wing="w", room="conversations")
    assert out == {"landed": 1}                                   # the daemon's payload rides back
    assert calls == [("capture",                                  # routed, never _owed
                      {"surface": "claude", "pointer": "/x/claude-main.jsonl",
                       "wing": "w", "room": "conversations"})]
    # the addressed sensorium threads as the daemon's `sensoriumRoot` (picks the holder by root)
    calls.clear()
    dc.pour("codex", "/y/codex.jsonl", wing="w", sensorium_root="/root/mesh")
    assert calls[0][1]["sensoriumRoot"] == "/root/mesh"
    # an absent wing falls to the coordinator default (capture needs a non-empty wing)
    calls.clear()
    dc.pour("claude", "/z", room="conversations")
    assert calls[0][1]["wing"] == "w"


def test_daemon_pour_refuses_shaping_args_over_the_wire(monkeypatch):
    # all/writeback/dry_run carry no `capture`-verb support — the routed pour REFUSES them (never routes
    # a silently-dropped shaping arg; dry_run=True would otherwise LAND for real). Same footgun the
    # standalone LaresCoordinator.pour guards, held at the wire.
    monkeypatch.setattr("lares_mcp.uds.output",
                        lambda *a, **k: pytest.fail("shaping args must not reach the wire"))
    dc = DaemonCoordinator(wing="w")
    for kwargs in ({"all": True}, {"writeback": True}, {"dry_run": True}):
        with pytest.raises(NotImplementedError):
            dc.pour("claude", "/x", wing="w", **kwargs)


def test_daemon_routes_the_lifecycle_and_plane_verbs(monkeypatch):
    # THE WALL CLEARED: status/worldline/kapae/un_kapae/plane_record now ride @daemon wire verbs — each
    # routes to the serve-op on the capture holder (the ONE palace owner) instead of `_owed`-refusing.
    # Record the wire call to prove the verb name + camelCase arg mapping without a live daemon.
    calls = []
    monkeypatch.setattr("lares_mcp.uds.output", lambda verb, args: (calls.append((verb, args)), {"ok": True})[1])
    dc = DaemonCoordinator(wing="w")

    assert dc.status() == {"ok": True}
    assert calls[-1] == ("status", {})                               # the taxonomy read, routed
    assert dc.worldline() == {"ok": True}
    assert calls[-1] == ("worldline", {})                            # the fork-DAG read, routed
    assert dc.kapae("branch", 1) == {"ok": True}
    assert calls[-1] == ("kapae", {"branch": "branch", "tick": 1})   # the branch-mute cascade, routed
    assert dc.un_kapae("branch", 2) == {"ok": True}
    assert calls[-1] == ("un_kapae", {"branch": "branch", "tick": 2})  # the restore cascade, routed
    assert dc.plane_record("f" * 64) == {"ok": True}
    assert calls[-1] == ("plane_record", {"cid": "f" * 64})          # the cross-plane witness, routed

    # the addressed sensorium threads as the daemon's `sensoriumRoot` on every routed verb (holder-by-root)
    calls.clear()
    dc.status(sensorium_root="/root/mesh")
    dc.plane_record("a" * 64, sensorium_root="/root/mesh")
    assert calls[0][1]["sensoriumRoot"] == "/root/mesh"
    assert calls[1][1]["sensoriumRoot"] == "/root/mesh"


def test_daemon_routed_set_names_the_wired_verbs():
    # the ROUTED set carries the wired lifecycle/plane/read verbs beside recall + pour — the routing table
    # the surface declares. `rejim` reads through the daemon `rejim` verb (repour rides `refresh`); `analyze`
    # routes to the daemon `analyze` verb (its registry entry lands in the wiki-VM TS build target). `ki` and
    # `li`/`jing` route to the TS hull's cohomology (the cosheaf coupling ⊥ sheaf gluing dual, and their
    # li∘ki square) — no python compute; the cohomology rides the browser-carried hull.
    assert DaemonCoordinator.ROUTED == {"recall", "pour", "sweep", "status", "worldline", "kapae",
                                        "un_kapae", "plane_record", "rejim", "analyze", "ki", "li", "jing",
                                        "couple_r", "forecast", "mismatch"}


# ── the sensorium address resolver (name → root; mirrors TS sensoriumDir/sensoriumNames) ──────


def test_sensorium_address_resolver_honors_lar_root(monkeypatch, tmp_path):
    # the py resolver mirrors TS sensoriumDir: <root>/sensoriums/<name>, so the MCP `sensorium=` address
    # and the CLI `lares sense <sensorium>` name ONE root byte-for-byte.
    from sensorium import sensorium_dir, sensorium_names
    monkeypatch.setenv("LAR_ROOT", str(tmp_path))
    assert sensorium_dir("memory") == os.path.join(str(tmp_path), "sensoriums", "memory")
    assert sensorium_names() == []                         # an absent dir rosters empty, never raises
    os.makedirs(os.path.join(str(tmp_path), "sensoriums", "ai-sessions"))
    assert "ai-sessions" in sensorium_names()             # a stood sensorium shows in the roster


def test_sensorium_address_resolver_refuses_an_unnamed_root(monkeypatch, tmp_path):
    # LAR_ROOT unset → the resolver refuses by name; no XDG base or home directory stands in for the house.
    from house_root import HouseRootUnnamed
    from sensorium import sensorium_dir
    monkeypatch.delenv("LAR_ROOT", raising=False)
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path))
    with pytest.raises(HouseRootUnnamed, match="set LAR_ROOT"):
        sensorium_dir("mesh")


def test_a_sensorium_address_never_routes_out_of_the_shrine(monkeypatch, tmp_path):
    # THE ONE ROUTE THAT DEFEATS AN ADDRESS. `sensorium=` arrives over the MCP, from outside this island
    # entirely; joined onto the shrine root, a name carrying `..` walks out of the house the ruling put
    # it in — and a traversing segment consults no wipe-list on the way. The shore refuses it.
    from sensorium import sensorium_dir, assert_one_segment
    monkeypatch.setenv("LAR_ROOT", str(tmp_path))
    assert sensorium_dir("memory") == os.path.join(str(tmp_path), "sensoriums", "memory")
    assert assert_one_segment("t", "memetic-wikitext") == "memetic-wikitext"   # a plain name passes
    for bad in ("..", ".", "", "../abide", "a/b", "/etc", "..\\win"):
        with pytest.raises(ValueError, match="ONE path segment"):
            sensorium_dir(bad)


# ── the human-query INSTRUMENTS: rejim (rhythm) · analyze (change-points) · the routed analyze wall ──


def test_coordinator_rejim_reads_geology_or_honest_absence(tmp_path):
    # rejim reads the landed rhythm/geology plane; never-repoured → an HONEST absence (never a lie), and a
    # `repour=True` re-derives from the poured content (reusing the ONE content handle) then reads it back.
    coord = _coord(tmp_path)
    coord.pour("claude", _FIXTURE, wing="w")
    absent = coord.rejim()
    assert absent["repoured"] is False and absent["geology"] is None      # never repoured — honest absence
    got = coord.rejim(repour=True)
    assert got["repoured"] is True
    g = got["geology"]
    assert isinstance(g, dict) and "rejim" in g and "stream_chars" in g   # the landed geology schema


def test_coordinator_analyze_returns_word_indexed_boundaries(tmp_path):
    # analyze runs the DETECT-ONLY arms over the poured content stream and returns a boundary map — every cut
    # a WORD INDEX into the reconstructed stream (the MAUP-free coordinate), the in-memory word cache dropped.
    coord = _coord(tmp_path)
    coord.pour("claude", _FIXTURE, wing="w")
    res = coord.analyze()
    assert res["n_words"] >= 1 and "boundaries" in res
    assert "_words" not in res                                            # the word cache never crosses the return
    n = res["n_words"]
    for arm, cuts in res["boundaries"].items():
        assert isinstance(cuts, list)
        assert all(isinstance(c, int) and 0 <= c <= n for c in cuts), f"{arm}: cut off the word axis"


def test_daemon_analyze_routes(monkeypatch):
    # analyze routes to the daemon `analyze` verb (the detect-only change-point read through the holder that
    # owns the store); the span rides the wire as `sample`, the addressed root threads through.
    calls = []
    monkeypatch.setattr("lares_mcp.uds.output", lambda verb, args: (calls.append((verb, args)), {"ok": True})[1])
    dc = DaemonCoordinator(wing="w")
    dc.analyze(spectral=True, span=8, sensorium_root="/root/mesh")
    assert calls[-1][0] == "analyze"
    assert calls[-1][1] == {"spectral": True, "sample": 8, "sensoriumRoot": "/root/mesh"}


def test_daemon_rejim_routes_and_repour_rides_refresh(monkeypatch):
    # rejim routes to the daemon `rejim` verb; `repour=True` first rides the reversible `refresh` verb
    # narrowed to the rejim enrichment (which=rejim), then reads — the addressed root threads through both.
    calls = []
    monkeypatch.setattr("lares_mcp.uds.output", lambda verb, args: (calls.append((verb, args)), {"ok": True})[1])
    dc = DaemonCoordinator(wing="w")
    dc.rejim()
    assert calls[-1] == ("rejim", {})                                     # the plane read, routed
    calls.clear()
    dc.rejim(repour=True, sensorium_root="/root/mesh")
    assert calls[0] == ("refresh", {"which": "rejim", "sensoriumRoot": "/root/mesh"})   # repour rides refresh
    assert calls[1] == ("rejim", {"sensoriumRoot": "/root/mesh"})         # then reads, root threaded


# ── the SENSE DOOR SHRINKS (road leap-ux-collapse, fold 1): the read instruments answer as lenses on one
#    `analyze` act, roster reads at two grains, pour carries the bulk pass. Each lens keeps its own wire verb. ──

# The seat acts each lens test drives, by the handler's own name.
_ACTS = {"analyze": "lar:///sense.rhythm.analyzes", "roster": "lar:///sense.roster.reads", "pour": "lar:///sense.capture.pours"}


def _routed_tools(monkeypatch):
    calls = []
    monkeypatch.setattr("lares_mcp.uds.output", lambda verb, args: (calls.append((verb, args)), {"answered": verb})[1])
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    tool = lambda name: mcp.seat_acts[_ACTS[name]]  # noqa: E731 — the seat act by its handler's name
    return mcp, tool, calls


def test_analyze_lens_routes_each_lens_to_its_own_wire_verb(monkeypatch):
    from lares_mcp import ANALYZE_LENSES, ANALYZE_LENS_READS
    _, tool, calls = _routed_tools(monkeypatch)
    for lens, wire in ANALYZE_LENSES.items():
        calls.clear()
        out = tool("analyze")(lens=lens, **({"rows": [[1.0, 2.0]]} if "signal" in ANALYZE_LENS_READS[lens] else {}))
        assert out["lens"] == lens                                  # every answer echoes the lens it applied
        assert calls[-1][0].replace("-", "_") == wire               # the lens chooses; the wire verb stays its own


def test_analyze_house_names_flow_to_their_plain_lens(monkeypatch):
    _, tool, calls = _routed_tools(monkeypatch)
    assert tool("analyze")(lens="ki")["lens"] == "couple" and calls[-1][0] == "ki"
    assert tool("analyze")(lens="li")["lens"] == "cohere" and calls[-1][0] == "li"


def test_analyze_unknown_or_missing_lens_refuses_naming_every_lens(monkeypatch):
    from lares_mcp import ANALYZE_LENSES, SeatArgumentRefused
    _, tool, calls = _routed_tools(monkeypatch)
    for asked in (None, "zz-no-such-lens"):
        with pytest.raises(SeatArgumentRefused) as refused:
            tool("analyze")(lens=asked)
        for lens in ANALYZE_LENSES:
            assert lens in str(refused.value)
    assert calls == []                                              # a refusal reaches no wire


def test_analyze_lenses_weld_to_the_cli_table():
    # ONE LENS TABLE, TWO SKINS: the fixture carries the CLI's own table (gen_cli_verbs.mjs reads SENSE_LENSES),
    # and the seat's table names the same lenses riding the same wire verbs.
    from lares_mcp import ANALYZE_LENSES, ANALYZE_LENS_ALIASES
    with open(_CLI_VERBS, encoding="utf-8") as f:
        inv = json.load(f)
    assert {k: v.replace("_", "-") for k, v in ANALYZE_LENSES.items()} == inv["analyze_lenses"]
    assert ANALYZE_LENS_ALIASES == inv["analyze_lens_aliases"]


def test_roster_reads_at_two_grains(monkeypatch):
    _, tool, calls = _routed_tools(monkeypatch)
    tool("roster")()
    assert calls[-1] == ("roster", {})
    tool("roster")(name="memory")
    assert calls[-1] == ("inspect", {"name": "memory"})


def test_pour_bulk_rides_the_sweep_spine(monkeypatch):
    _, tool, calls = _routed_tools(monkeypatch)
    tool("pour")(bulk=True, surface="claude", limit=3)
    assert calls[-1][0] == "sweep" and calls[-1][1]["surface"] == "claude" and calls[-1][1]["limit"] == 3
    tool("pour")(surface="claude", pointer="/x.jsonl")
    assert calls[-1][0] == "capture" and calls[-1][1]["pointer"] == "/x.jsonl"


def test_pour_bulk_refuses_the_one_pointer_shaping(monkeypatch):
    # `bulk` rides the sweep spine, which carries no preview, no writeback, no pointer and no room: each refuses by
    # name before the wire, never drops silently (a dropped dry_run would LAND a real backfill on append-only ground).
    from lares_mcp import SeatArgumentRefused
    _, tool, calls = _routed_tools(monkeypatch)
    for shaping, named in (({"dry_run": True}, "dry_run"), ({"writeback": True}, "writeback"),
                           ({"pointer": "/x.jsonl"}, "pointer"), ({"room": "elsewhere"}, "room")):
        with pytest.raises(SeatArgumentRefused) as refused:
            tool("pour")(bulk=True, **shaping)
        assert named in str(refused.value)
    assert calls == []


def test_analyze_refuses_an_argument_its_lens_never_reads(monkeypatch):
    # The lens reads only its own arguments (the CLI refuses a stray flag by name); the seat reads the same table.
    from lares_mcp import SeatArgumentRefused
    _, tool, calls = _routed_tools(monkeypatch)
    for lens, stray in (("couple", {"spectral": True}), ("changes", {"rows": [[1.0]]}),
                        ("forecast", {"names": ["a"]}), ("rhythm", {"halves": "4,8"}), ("square", {"repour": True})):
        with pytest.raises(SeatArgumentRefused) as refused:
            tool("analyze")(lens=lens, **stray)
        assert next(iter(stray)) in str(refused.value)
    assert calls == []
    tool("analyze")(lens="changes", spectral=True, halves="4,8", span=8)      # CONTROL: its own arguments ride
    assert calls[-1][0] == "analyze"


def test_analyze_lens_reads_weld_to_the_cli_table():
    from lares_mcp import ANALYZE_LENS_READS
    with open(_CLI_VERBS, encoding="utf-8") as f:
        inv = json.load(f)
    assert {k: sorted(v) for k, v in ANALYZE_LENS_READS.items()} == {k: sorted(v) for k, v in inv["analyze_lens_reads"].items()}


def test_the_wiki_acts_switch_keep_and_unkeep_by_slug(monkeypatch):
    from lares_mcp import SeatArgumentRefused
    mcp, _, calls = _routed_tools(monkeypatch)
    acts = (("lar:///engine.wiki.switches", "wiki-switch"), ("lar:///engine.wiki.keeps", "wiki-keep"),
            ("lar:///engine.wiki.unkeeps", "wiki-unkeep"))
    for address, verb in acts:
        mcp.seat_acts[address](slug="w")
        assert calls.pop() == (verb, {"slug": "w"})
    for address, _ in acts:
        with pytest.raises(SeatArgumentRefused, match="slug"):
            mcp.seat_acts[address](slug="")
    assert calls == []


# ── THE ONE CALL (comms-ux-enacts landing 11): five tools, each forwarding {verb, params} to the vessel's `call`; an act
#    whose handler rests in the seat comes back `handler/seat` with its bound args, and the seat runs it. ──

_HINTS = {"get": (True, False, True, False), "put": (False, True, False, False), "delete": (False, True, False, False),
          "rename": (False, True, False, False), "act": (False, True, False, True)}


def test_the_five_tools_state_their_annotations():
    # The schema's defaults read worst-case, so each tool states all four: `get` reads; the writes move records; `act`
    # reaches any affordance a carrier names, so it reads open-world.
    from copy import deepcopy
    tools = asyncio.run(build_mcp(DaemonCoordinator(wing="w")).list_tools())

    def check(tool):
        a = tool.annotations
        assert a is not None, tool.name
        assert (a.read_only_hint, a.destructive_hint, a.idempotent_hint, a.open_world_hint) == _HINTS[tool.name], tool.name

    assert {t.name for t in tools} == set(_HINTS)
    for tool in tools:
        check(tool)
    planted = deepcopy(next(t for t in tools if t.name == "get"))
    planted.annotations = None
    with pytest.raises(AssertionError):
        check(planted)
    planted = deepcopy(next(t for t in tools if t.name == "act"))
    planted.annotations.read_only_hint = True
    with pytest.raises(AssertionError):
        check(planted)


def test_the_tools_take_their_words_from_the_carriers():
    # THE WORDS LIVE IN THE CARRIERS: each record tool's description renders from its carriers' mcp wholes, the act's from
    # every carrier by address and role, the instructions from the lead and the carriers the pack routes to this seat.
    from lares_mcp import act_description, carrier_words, read_affordance_pack, seat_instructions
    pack = read_affordance_pack()
    carriers = {"get": ["lar:///engine.record.reads", "lar:///engine.filter.pages"], "put": ["lar:///engine.record.puts"],
                "delete": ["lar:///engine.record.removes"], "rename": ["lar:///engine.record.renames"]}
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    listed = {t.name: t for t in asyncio.run(mcp.list_tools())}
    for tool, addresses in carriers.items():
        for address in addresses:
            assert carrier_words(address, pack), \
                f"affordance-pack-stale: the pack holds no mcp words for {address}; re-bake: pnpm --filter @lararium/tw5 build"
        assert listed[tool].description == "\n".join(line for a in addresses for line in carrier_words(a, pack)), tool
    assert listed["act"].description == act_description(pack)
    assert mcp.instructions == seat_instructions(pack)


def _wired(monkeypatch, answer):
    """Stand the vessel's socket: each line the seat sends records as (verb, args), and `answer(verb, args)` speaks back."""
    calls = []

    def wire(verb, args=None, **_kw):
        calls.append((verb, args))
        return {"results": {"summary": {"ok": True, "output": answer(verb, args)}}}

    monkeypatch.setattr("lares_mcp.uds.call", wire)
    return calls


def _call_tool(mcp, name: str, args: dict):
    async def go():
        try:
            return False, str(await mcp.call_tool(name, args))
        except Exception as e:  # noqa: BLE001 — the seat's own tool error
            return True, str(e)
    return asyncio.run(go())


def test_act_reaches_the_oracle_cast_wire_the_cast_handler_sends(monkeypatch):
    # RED on 421e4a4df^ (the landing-8 head): no `act` tool stands; the cast rode its own `oracle_cast` tool.
    # GREEN on 421e4a4df: the call rides `call` by address, the vessel binds the recipe and answers handler/seat, and the
    # seat's cast sends `oracle-cast` with its own time stamp and the caster `agent`.
    address = "lar:///library.oracle.speaks"

    def answer(verb, args):
        if verb == "call":
            return {"handler": "seat", "address": address, "params": {**args["params"], "recipe": "default"}}
        return {"decision": "put", "title": "casts/x"}

    calls = _wired(monkeypatch, answer)
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    out = mcp._tool_manager.get_tool("act").fn(address=address, args={"asking": "q"})  # noqa: SLF001 — the registered skin
    assert out == {"decision": "put", "title": "casts/x"}
    assert calls[0] == ("call", {"verb": address, "params": {"asking": "q"}, "surface": "mcp"})
    assert len(calls) == 2 and calls[1][0] == "oracle-cast"
    sent = calls[1][1]
    assert sent["recipe"] == "default" and sent["caster"] == "agent" and sent["asking"] == "q"
    assert isinstance(sent["at"], str) and sent["at"].endswith("Z")
    # CONTROL: the cast handler, called with the same bound args, sends the same wire (its time stamp aside).
    calls.clear()
    mcp.seat_acts[address](recipe="default", asking="q")
    assert {k: v for k, v in calls[0][1].items() if k != "at"} == {k: v for k, v in sent.items() if k != "at"}


def test_act_runs_a_seat_act_with_no_new_tool_and_returns_a_plain_answer_unchanged(monkeypatch):
    # RED on 421e4a4df^: no `act` tool, and no `seat_acts` map on the server. GREEN on 421e4a4df: the vessel answers
    # handler/seat for an address the seat holds, and the seat runs it with the handler's own names alone (a kebab name in
    # its Python spelling; a shared default the handler takes no word for stays at the vessel); an address the vessel
    # answers itself comes back as spoken, one line on the wire; the tool list stays five.
    dates, render, follows = "lar:///oracle.calendar.dates", "lar:///engine.wiki.renders", "lar:///engine.status.follows"
    plain = {"has": f"<<~ has name=`{follows}`>>", "rows": []}

    def answer(verb, args):
        if verb == "call" and args["verb"] == dates:
            return {"handler": "seat", "address": dates, "params": {"day": 5, "month": 1, "year": 2024, "zz-shared-default": "x"}}
        if verb == "call" and args["verb"] == render:
            return {"handler": "seat", "address": render, "params": {"title": "T", "recipe": "default", "max-bytes": 9}}
        if verb == "call":
            return plain
        return {"text": f"answered {verb}"}

    calls = _wired(monkeypatch, answer)
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    act = mcp._tool_manager.get_tool("act").fn  # noqa: SLF001 — the registered skin
    assert act(address=dates, args={"day": 5, "month": 1, "year": 2024}) == {"text": "answered ddate"}
    assert [verb for verb, _ in calls] == ["call", "ddate"]
    assert {k: calls[1][1][k] for k in ("day", "month", "year")} == {"day": 5, "month": 1, "year": 2024}
    assert "today" in calls[1][1] and "zz_shared_default" not in calls[1][1] and "zz-shared-default" not in calls[1][1]
    calls.clear()
    act(address=render, args={"title": "T", "max_bytes": 9})
    assert calls[0][1]["params"] == {"title": "T", "max-bytes": 9}
    assert calls[1] == ("wiki-render", {"recipe": "default", "title": "T", "maxBytes": 9})
    calls.clear()
    assert act(address=f" {follows} ") == plain
    assert calls == [("call", {"verb": follows, "params": {}, "surface": "mcp"})]
    assert {t.name for t in asyncio.run(mcp.list_tools())} == SEAT_TOOLS


def test_act_holds_a_watch_on_a_session_above_its_hold_and_every_other_address_rides_the_one_shot_line(monkeypatch):
    # RED before comms-ux-one: `act` sent every address down the one-shot line under the default wait, so a watch (which holds
    # until its filter moves and names the face that bound it) answered `watch-faceless` or timed out before its hold ran out.
    # GREEN: lar:///engine.filter.watches rides a session of the seat's face, its wait above the hold it names (else the
    # default hold); a msg, like every other address, keeps the one-shot line.
    from lares_mcp import WATCH_HOLD_MS, WATCH_WAIT_SLACK_S
    lines = []

    def session(verb, args=None, **kw):
        lines.append(("session", verb, args, kw))
        return {"results": {"summary": {"ok": True, "output": {"band": "unchanged", "id": "w1"}}}}

    def one_shot(verb, args=None, **kw):
        lines.append(("call", verb, args, kw))
        return {"results": {"summary": {"ok": True, "output": {"has": "<<~ has>>"}}}}

    monkeypatch.setattr("lares_mcp.uds.session_call", session)
    monkeypatch.setattr("lares_mcp.uds.call", one_shot)
    act = build_mcp(DaemonCoordinator(wing="w"))._tool_manager.get_tool("act").fn  # noqa: SLF001 — the registered skin
    watch = "lar:///engine.filter.watches"
    assert act(address=watch, args={"filter": "[tag[x]]", "hold": 4000}) == {"band": "unchanged", "id": "w1"}
    kind, verb, args, kw = lines[-1]
    assert (kind, verb) == ("session", "call") and args == {"verb": watch, "params": {"filter": "[tag[x]]", "hold": 4000}, "surface": "mcp"}
    assert kw["timeout"] == 4.0 + WATCH_WAIT_SLACK_S and kw["vessel_wait_ms"] > 4000
    act(address=watch, args={"id": "w1", "mu": "00"})
    assert lines[-1][0] == "session" and lines[-1][3]["timeout"] == WATCH_HOLD_MS / 1000.0 + WATCH_WAIT_SLACK_S
    act(address="lar:///engine.msg.lands", args={"stream": "lares-alpha#00003", "note": "hi"})
    assert lines[-1][0] == "call" and lines[-1][3] == {}


def test_act_refuses_a_seat_answer_it_holds_no_handler_for_and_an_unnamed_address(monkeypatch):
    from lares_mcp import SeatArgumentRefused, SeatVerbOwed
    calls = _wired(monkeypatch, lambda verb, args: {"handler": "seat", "address": "lar:///kahu.notes.reads", "params": {}})
    act = build_mcp(DaemonCoordinator(wing="w"))._tool_manager.get_tool("act").fn  # noqa: SLF001
    with pytest.raises(SeatVerbOwed, match=r"seat-act-unheld.*lar:///kahu\.notes\.reads.*aperture=\"measure\""):
        act(address="lar:///kahu.notes.reads")
    assert len(calls) == 1
    with pytest.raises(SeatArgumentRefused, match="name an affordance `address`"):
        act(address="   ")
    assert len(calls) == 1


def test_a_hand_address_refuses_with_its_cure_and_a_host_act_names_the_terminal(monkeypatch):
    # RED on 421e4a4df^: no `act` tool stands, so the call answers an unknown tool. GREEN on 421e4a4df: the vessel's own
    # hand check refuses the call, and the tool error carries its words and its cure; an act the terminal's door runs
    # (`handler/host`) refuses `host-door`, naming the command for the operator's terminal, and runs nothing.
    import lares_uds as uds
    cure = ("promote-needs-hand: lar:///realm.offer.commits runs on a person's hand alone. "
            "Ask the operator to run `lares trust commit <cid>` on their own terminal.")

    def refuse(verb, args=None, **_kw):
        raise uds.LaresVerbError(cure, "promote-needs-hand")

    monkeypatch.setattr("lares_mcp.uds.call", refuse)
    mcp = build_mcp(DaemonCoordinator(wing="w"))
    is_error, said = _call_tool(mcp, "act", {"address": "lar:///realm.offer.commits", "args": {"cid": "a" * 64}})
    assert is_error and "promote-needs-hand" in said and "Ask the operator to run `lares trust commit" in said, said
    host = "lar:///carriage.record.adds"
    calls = _wired(monkeypatch, lambda verb, args: {"handler": "host", "address": host, "params": {"title": "T"}})
    is_error, said = _call_tool(mcp, "act", {"address": host, "args": {"title": "T"}})
    assert is_error and "host-door" in said and f"lares act {host}" in said, said
    assert [verb for verb, _ in calls] == ["call"]
