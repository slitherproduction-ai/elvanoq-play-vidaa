import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const requests=[];const EP={Config:{platform:'vidaa',portalUrl:'/api/portal',codePrefix:'VD'},VERSION:'1.1.5',extend:Object.assign,text:v=>String(v||''),lower:v=>String(v).toLowerCase(),PlaylistRules:{isHttpUrl:v=>/^https?:/.test(v)},Http:{postJson:async(url,payload)=>{requests.push(payload);return {status:200,body:payload.action==='webos-device-register'?{registered:true}:payload.action==='server-code-resolve'?{server_code:'pfast',server:{host:'http://provider.example'},license:{can_play:true},code_access:{can_connect:true}}:{license:{can_play:true},code_access:{can_connect:true}}};},json:r=>r.body}};const window={EP,localStorage:{getItem:()=>null,setItem:()=>{}}};vm.runInNewContext(fs.readFileSync(new URL('../public/src/services/portalService.js',import.meta.url),'utf8'),{window,Promise,Date,Math,Uint8Array});EP.Portal.identity={deviceId:'a'.repeat(64),key:'123456'};
const result=await EP.Portal.serverCodeResolve('pfast');assert(result.ok);assert.equal(result.host,'http://provider.example');assert.deepEqual(requests.map(x=>x.action),['webos-device-register','server-code-resolve']);assert.equal(requests[1].device_id,'a'.repeat(64));assert.equal(requests[1].device_key,'123456');assert(!('mac' in requests[1]));assert(!('password' in requests[1]));assert.equal(await EP.Portal.ensurePlayable(),true);assert.equal(EP.Portal.identity.serverCode,'pfast');console.log('PASS VIDAA client registers identity, authenticates code resolution and revalidates active playback without provider credentials or external MAC.');

// Identidade: SHA-256 do ID VIDAA (estável) e código VD-; sem a API, identidade local.
{
  const store={};const EP2={Config:{platform:'vidaa',portalUrl:'/api/portal',codePrefix:'VD'},VERSION:'1.0.0',extend:Object.assign,text:v=>String(v||''),lower:v=>String(v).toLowerCase(),
    Sha256:{sha256:async s=>(await import('node:crypto')).createHash('sha256').update(s).digest('hex')},vidaaDeviceId:()=>'HSN-123456789'};
  const win={EP:EP2,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=v;}}};
  vm.runInNewContext(fs.readFileSync(new URL('../public/src/services/portalService.js',import.meta.url),'utf8'),{window:win,Promise,Date,Math,Uint8Array});
  const id=await EP2.Portal.ensureIdentity();
  const expected=(await import('node:crypto')).createHash('sha256').update('vidaa-device:HSN-123456789').digest('hex');
  assert.equal(id.deviceId,expected);assert.equal(id.source,'vidaa');assert.match(EP2.Portal.deviceCode(),/^VD-[0-9A-F]{12}$/);
  assert(!JSON.stringify(store).includes('HSN-123456789'),'ID do aparelho nunca é gravado em texto puro');
  EP2.vidaaDeviceId=()=>'';EP2.Portal.identity=null;const local=await EP2.Portal.ensureIdentity();assert.equal(local.source,'local');assert.notEqual(local.deviceId,expected);
  console.log('PASS VIDAA identity: hashed device ID, VD- code, local fallback.');
}
