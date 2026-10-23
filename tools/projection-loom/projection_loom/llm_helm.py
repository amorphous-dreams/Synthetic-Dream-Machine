"""Opt-in LLM advice for the durable Operator/AI helm.

The model receives bounded, source-classified summaries (not original images,
secrets, CAD execution handles or free-form tools). It may suggest only one
validated candidate id, or ask one bounded investigation question. The OODA
journal remains responsible for every decision, intervention, and CAD gate.
Network requests stay synchronous at checkpoint boundaries; resumed journals
must not replay completed adviser consultations.
"""
from __future__ import annotations

import json
import os
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

_MAX_CONTEXT = 12000
_MAX_REPLY = 16000

class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('LLM endpoint redirects are not accepted')


def _verified_endpoint(url, kind):
    parsed = urlparse(str(url))
    if (parsed.username or parsed.password or parsed.query or parsed.fragment or
        parsed.scheme not in ('http', 'https') or not parsed.hostname):
        raise ValueError('LLM endpoint requires a clean HTTP(S) URL without credentials')
    if parsed.scheme == 'http' and parsed.hostname not in ('localhost', '127.0.0.1', '::1'):
        raise ValueError('Unencrypted provider HTTP must remain on loopback')
    if kind not in ('ollama', 'openai-compatible'):
        raise ValueError('Unknown LLM provider type')
    return str(url)


class HelmLLM:
    """Narrow adviser adapter; no model response can issue an operator control."""
    def __init__(self, kind, model, *, endpoint=None, api_key_env='OPENAI_API_KEY',
                 timeout=35, transport=None):
        if not isinstance(model, str) or not model.strip() or len(model) > 200:
            raise ValueError('Specify a bounded nonempty LLM model')
        if not isinstance(timeout, (int, float)) or not 1 <= timeout <= 120:
            raise ValueError('Provider timeout must be 1..120 seconds')
        fallback=('http://127.0.0.1:11434/api/chat' if kind=='ollama'
                  else 'https://api.openai.com/v1/chat/completions')
        self.kind=kind
        self.model=model.strip()
        self.endpoint=_verified_endpoint(endpoint or fallback, kind)
        self.api_key_env=api_key_env
        self.timeout=float(timeout)
        self._transport=transport

    def _reply(self, purpose, context):
        serialized=json.dumps(context, sort_keys=True, allow_nan=False, ensure_ascii=False)
        if len(serialized) > _MAX_CONTEXT:
            raise ValueError('LLM context exceeds bounded evidence envelope')
        if purpose == 'choice':
            system=('You advise a CAD architecture reconstruction run. Return ONLY a JSON object '
                    'with proposal_id and short reason; or {"abstain":true}. '
                    'Select an id from the supplied audited options. Never certify geometry '
                    'or registration. Account for the source evidence_state.')
        elif purpose == 'phase':
            system=('You advise a five-phase OODA-HA CAD workflow. Return ONLY '
                    '{"question":"bounded inquiry"} to request a deeper human review, '
                    'or {"abstain":true}. Do not propose execution commands. '
                    'Avoid needless inquiries; respect provisional evidence.')
        else:
            raise ValueError('Unknown LLM task')
        messages=[{'role':'system','content':system},
                  {'role':'user','content':serialized}]
        if self.kind == 'ollama':
            body={'model':self.model,'messages':messages,'stream':False,'format':'json',
                  'options':{'temperature':0}}
        else:
            body={'model':self.model,'messages':messages,'temperature':0,
                  'response_format':{'type':'json_object'}}
        headers={'Content-Type':'application/json'}
        key=os.environ.get(self.api_key_env)
        if self.kind=='openai-compatible':
            if not key and self.endpoint.startswith('https://api.openai.com/'):
                raise RuntimeError('OPENAI_API_KEY is required for the OpenAI endpoint')
            if key:headers['Authorization']='Bearer '+key
        request=Request(self.endpoint,data=json.dumps(body,allow_nan=False).encode('utf8'),
                        headers=headers,method='POST')
        if self._transport is None:
            with build_opener(_NoRedirect()).open(request,timeout=self.timeout) as stream:
                payload=stream.read(_MAX_REPLY+1)
        else:
            payload=self._transport(request,self.timeout)
        if len(payload)>_MAX_REPLY:
            raise ValueError('LLM response exceeds bounded reply limit')
        result=json.loads(payload)
        response=(result.get('message',{}).get('content') if self.kind=='ollama' else
                  result['choices'][0]['message']['content'])
        if not isinstance(response,str) or len(response)>8000:
            raise ValueError('LLM content is missing or excessive')
        answer=json.loads(response)
        if not isinstance(answer,dict):
            raise ValueError('LLM must return one JSON object')
        return answer

    def choose(self, context):
        choices=context.get('options',())
        if not choices:return None
        allowed={x['proposal_id'] for x in choices}
        # Keep only the fields the LLM needs, not local filenames or paths.
        envelope={'location':context['location'],'epoch':context['epoch'],
                  'evidence_state':context['evidence_state'],
                  'autonomy':context['autonomy'],
                  'options':[{'proposal_id':x['proposal_id'],
                              'loss':x['loss'],'emitter':x.get('emitter'),
                              'phenotype':x.get('phenotype',[])[:40]}
                             for x in choices]}
        response=self._reply('choice',envelope)
        if response=={'abstain':True}:
            return None
        if set(response)!={'proposal_id','reason'} or response['proposal_id'] not in allowed:
            raise ValueError('LLM proposed an unvalidated candidate or malformed decision')
        return {'proposal_id':response['proposal_id'],
                'reason':str(response['reason'])[:1000]}

    def phase(self, context):
        envelope={k:context.get(k) for k in ('loop_id','scope','phase','parent_phase','autonomy')}
        envelope['evidence']=context.get('evidence',{})
        response=self._reply('phase',envelope)
        if response=={'abstain':True}:
            return None
        if (set(response)!={'question'} or not isinstance(response['question'],str)
                or not response['question'].strip() or len(response['question'])>4096):
            raise ValueError('LLM proposed a malformed inquiry')
        return {'question':response['question']}
