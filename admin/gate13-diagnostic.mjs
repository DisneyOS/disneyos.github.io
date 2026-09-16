const codes=new Set(['PROFILE_ACCESS_DENIED','PARTY_ACCESS_DENIED','CONTEXT_PROFILE_ACCESS_DENIED','INGEST_REPLAY_DENIED','PASS','ASSERTION_FAILED','SECURITY_FAILURE','CLEANUP_FAILED','PREFLIGHT_FAILED','ALREADY_EXECUTED']);
export function safeGate13Text(value) {
  const code=codes.has(value?.safeCode)?value.safeCode:'ASSERTION_FAILED';
  const stage=['PREFLIGHT','FIXTURES','PROFILE','PARTY','REPLAY','COMPLETE'].includes(value?.assertion)?value.assertion:'PREFLIGHT';
  const cleanup=['PASS','FAIL','NOT_RUN'].includes(value?.cleanupStatus)?value.cleanupStatus:'NOT_RUN';
  const results=Array.isArray(value?.results)?value.results.slice(0,3).filter(r=>['PROFILE','PARTY','REPLAY'].includes(r?.assertion)).map(r=>`${r.assertion}: ${r.result==='PASS'?'PASS':'FAIL'}; ${codes.has(r.safeCode)?r.safeCode:'ASSERTION_FAILED'}; HTTP ${[200,403].includes(r.httpStatus)?r.httpStatus:0}`).join('\n'):'';
  return `${code}; stage ${stage}; cleanup ${cleanup}${results?'\n'+results:''}`;
}
