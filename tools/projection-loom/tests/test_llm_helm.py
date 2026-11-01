import json
import pytest
from projection_loom.llm_helm import HelmLLM


def mock(content, kind='ollama'):
    if kind=='ollama':return json.dumps({'message':{'content':json.dumps(content)}}).encode()
    return json.dumps({'choices':[{'message':{'content':json.dumps(content)}}]}).encode()


def case(provider='ollama', response=None, **kwargs):
    return HelmLLM(provider,'fixture-model',transport=lambda req, timeout:mock(
        response if response is not None else {'abstain':True},provider),**kwargs)


CTX={'location':'poc-0','epoch':1,'evidence_state':'provisional',
     'autonomy':.75,'options':[{'proposal_id':'candidate-0002','loss':.29,
     'emitter':'topology','genome':'PRIVATE PATH MUST NOT APPEAR'}]}


def test_ollama_choice_can_only_select_audited_candidate():
    provider=case(response={'proposal_id':'candidate-0002','reason':'gateway variation'})
    assert provider.choose(CTX)['proposal_id']=='candidate-0002'
    with pytest.raises(ValueError,match='unvalidated'):
        case(response={'proposal_id':'candidate-0050','reason':'invented'}).choose(CTX)


def test_openai_compatible_provider_choice_and_missing_key_check(monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY','mock-key')
    provider=case('openai-compatible',{'proposal_id':'candidate-0002','reason':'scored'})
    assert provider.choose(CTX)['proposal_id']=='candidate-0002'
    monkeypatch.delenv('OPENAI_API_KEY')
    with pytest.raises(RuntimeError, match='required'):
        provider.choose(CTX)


def test_phase_question_and_abstention():
    context={'loop_id':'epoch-0001','scope':'epoch','phase':'observe',
             'parent_phase':'act','autonomy':.8,'evidence':{'has':'uncertain'}}
    assert case(response={'question':'What is the gap?' }).phase(context)
    assert case().phase(context) is None
    with pytest.raises(ValueError,match='malformed'):
        case(response={'run_shell':'rm -rf /'}).phase(context)


def test_provider_transmits_no_private_local_paths():
    sent=[]
    def transport(req, timeout):
        sent.append(req.data.decode())
        return mock({'abstain':True})
    provider=HelmLLM('ollama','fixture-model',transport=transport)
    assert provider.choose(CTX) is None
    assert 'PRIVATE PATH' not in sent[0]
    assert 'provisional' in sent[0]


def test_endpoints_and_sizes_fail_closed():
    with pytest.raises(ValueError,match='Unencrypted'):
        case(endpoint='http://example.com/v1')
    with pytest.raises(ValueError,match='credentials'):
        case(endpoint='http://abc:xyz@localhost:11434/api/chat')
    huge=dict(CTX);huge['options']=[dict(CTX['options'][0],phenotype=['x'*12000])]
    # Reject excessive context before network.
    with pytest.raises(ValueError,match='bounded evidence envelope'):
        case().choose(huge)
    with pytest.raises(ValueError,match='unvalidated'):
        case(response={'proposal_id':'x','reason':'z'}).choose(CTX)
