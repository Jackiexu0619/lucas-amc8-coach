import catalog from './question_index.json' with { type: 'json' };
import { MODEL, buildDeepSeekRequest, parseDeepSeekResponse, validateRequest } from './core.mjs';

const allowedOrigin='https://jackiexu0619.github.io';
function headers(req:Request){
  const origin=req.headers.get('origin');
  return {'Content-Type':'application/json','Access-Control-Allow-Origin':origin===allowedOrigin?allowedOrigin:'null',
    'Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS',
    'Cache-Control':'no-store'};
}
function json(req:Request,data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:headers(req)});}
async function sha256Hex(value:string){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:headers(req)});
  if(req.method!=='POST')return json(req,{error:'method_not_allowed'},405);
  const origin=req.headers.get('origin');
  if(origin&&origin!==allowedOrigin)return json(req,{error:'forbidden_origin'},403);
  const length=Number(req.headers.get('content-length')||0);
  if(length>2048)return json(req,{error:'request_too_large'},413);
  let body:unknown;
  try{
    const raw=await req.text();
    if(raw.length>2048)return json(req,{error:'request_too_large'},413);
    body=JSON.parse(raw);
  }catch{return json(req,{error:'invalid_json'},400);}
  const input=validateRequest(body,catalog);
  if('error' in input)return json(req,{error:input.error},400);

  const apiKey=Deno.env.get('DEEPSEEK_API_KEY');
  const url=Deno.env.get('SUPABASE_URL');
  let secret='';
  try{secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||'';}catch{}
  if(!apiKey||!url||!secret)return json(req,{error:'service_not_configured'},503);

  const syncHash=await sha256Hex(input.code);
  let authorization:Response;
  try{
    authorization=await fetch(url+'/rest/v1/rpc/amc8_explain_authorize_and_charge',{
      method:'POST',headers:{apikey:secret,'Content-Type':'application/json'},
      body:JSON.stringify({p_sync_hash:syncHash}),signal:AbortSignal.timeout(5000)
    });
  }catch{return json(req,{error:'authorization_unavailable'},503);}
  if(!authorization.ok)return json(req,{error:'authorization_unavailable'},503);
  let decision='';
  try{decision=await authorization.json();}catch{}
  if(decision==='unauthorized')return json(req,{error:'sync_code_unregistered'},403);
  if(decision==='rate_limited')return json(req,{error:'rate_limited'},429);
  if(decision!=='ok')return json(req,{error:'authorization_unavailable'},503);

  let upstream:Response;
  try{
    upstream=await fetch('https://api.deepseek.com/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+apiKey},
      body:JSON.stringify(buildDeepSeekRequest(input)),signal:AbortSignal.timeout(30000)
    });
  }catch{return json(req,{error:'model_timeout_or_network'},504);}
  if(!upstream.ok)return json(req,{error:'model_unavailable'},502);
  let result:unknown;
  try{result=await upstream.json();}catch{return json(req,{error:'invalid_model_json'},502);}
  const parsed=parseDeepSeekResponse(result,input);
  if('error' in parsed)return json(req,parsed,422);
  return json(req,{ok:true,model:MODEL,lesson:parsed.lesson});
});
