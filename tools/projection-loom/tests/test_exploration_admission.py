"""Budgeted screen never elevates a preview to native validity."""
from projection_loom.epochs import CandidateAdapter, Proposal, WideEpoch
from projection_loom.solid import SolidAssembly, box


def test_native_admission_returns_attributed_rejection(tmp_path):
    def grow(genome):
        assembly = SolidAssembly()
        assembly.add("root", box((0, 0, 0), (2, 2, 2)), parents=())
        return assembly

    epoch = WideEpoch(location="screen-witness",
                      source_digests={}, construction_digest="synthetic",
                      objectives=("silhouette",), score_state="synthetic",
                      checkpoint=tmp_path / "epoch.json", max_exact=1, max_detail=1)
    screened = []
    def gate(genome, assembly):
        screened.append(assembly.audit(join=True)["valid"])
        return {"accepted": False, "reason": "outside-envelope"}

    adapter = CandidateAdapter(grow=grow, score=lambda g,a: {"silhouette": 0.},
                               admission_hook=gate)
    result = epoch.run([Proposal("a", "sobol", {"x": .1})], adapter=adapter)
    assert screened == [True]
    assert result["results"]["a"]["state"] == "rejected"
    assert result["results"]["a"]["reason"] == "exploration-envelope"
    assert result["results"]["a"]["audit"]["valid"]


def test_scored_candidate_keeps_auxiliary_evidence(tmp_path):
    assembly = SolidAssembly()
    assembly.add("root", box((0,0,0),(2,2,2)), parents=())
    epoch = WideEpoch(location="aux-measure",source_digests={},
                      construction_digest="synthetic",objectives=("silhouette",),
                      score_state="synthetic",checkpoint=tmp_path/"epoch.json",
                      max_exact=1,max_detail=1)
    result = epoch.run(
        [Proposal("a","sobol",{"x":.1})],
        adapter=CandidateAdapter(
            grow=lambda genome:assembly,
            score=lambda g,a:{"silhouette":.2},
            admission_hook=lambda g,a:{"accepted":True,"geometry":{"faces":12}},
            measurement_hook=lambda g,a:{"extra_fraction":.05}))
    row=result["results"]["a"]
    assert row["state"]=="scored"
    assert row["extra_observations"]["extra_fraction"] == .05
    assert row["screening"]["accepted"]
