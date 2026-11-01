"""Identical independent seed sets preserve construction despite adapter ordering."""
from projection_loom.generalized_campaign import initial_program, run_cohort
from projection_loom.intent_seed import IntentContract, SeedBundle
from projection_loom.seed_adapters import compose_adapters
from experiments.zero.run import fixture_adapters
from test_generalized_campaign import fixture


def test_seed_order_isomorphism_preserves_composition_and_native_receipts(tmp_path):
    inputs=fixture(tmp_path)
    forward=fixture_adapters(inputs,("image","brutalist","ziggurat"))
    reverse=tuple(reversed(forward))
    contract=IntentContract(
        "mixed-order-equivalence",
        "build independently attributed experimental architectural seeds",
        ("native-validity","structural-novelty"),
        budgets=(("epochs",1),("exact",1),("offspring",2)))
    assert SeedBundle(tuple(a.seed for a in forward)).manifest()==SeedBundle(
        tuple(a.seed for a in reverse)).manifest()
    assert initial_program(forward).identity==initial_program(reverse).identity
    left=compose_adapters(forward,contract)
    right=compose_adapters(reverse,contract)
    assert left.location.to_dict()==right.location.to_dict()
    assert left.audit()==right.audit()
    options={"epochs":1,"offspring":2,"exact_budget":1,"finalists":1,"seed":51}
    original=tmp_path/"forward"
    rearranged=tmp_path/"reverse"
    first=run_cohort(forward,contract,original,**options)
    second=run_cohort(reverse,contract,rearranged,**options)
    assert first==second
    for relative in ("pre_registration.json","epoch_000.json",
                     "summary.json","receipts/e00c00.json"):
        assert (original/relative).read_bytes()==(rearranged/relative).read_bytes()
    assert run_cohort(reverse,contract,rearranged,**options)==second
