import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const base='http://127.0.0.1:3000',origin='https://weallcreate.example';
async function ready(){for(let attempt=0;attempt<40;attempt++){try{const r=await fetch(base+'/api/health');if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw Error('Container did not become healthy');}
await ready();for(const path of ['/','/app.js','/features-ui.js','/legacy.js','/site.css'])assert.equal((await fetch(base+path)).status,200);
const home=await fetch(base);assert.match(home.headers.get('content-security-policy'),/script-src 'self';/);assert.equal((await fetch(base+'/.env')).status,404);
const register=await fetch(base+'/api/auth/register',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'CI Creator',email:'ci@example.test',password:'Disposable-CI-password-123'})});assert.equal(register.status,200);const header=register.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/Secure/);const cookie=header.split(';')[0];
const blocked=await fetch(base+'/api/records',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({kind:'profile',name:'Unverified'})});assert.equal(blocked.status,403);
execFileSync('docker',['restart','weallcreate-smoke'],{stdio:'pipe'});await ready();const me=await fetch(base+'/api/me',{headers:{Cookie:cookie}});assert.equal((await me.json()).user.name,'CI Creator');console.log('Production container smoke test passed: assets, security, volume writes and restart persistence.');
