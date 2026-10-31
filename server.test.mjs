import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from './server.mjs';
import {createHmac} from 'node:crypto';
import {mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('accounts, ownership, persistence boundaries, search data, and payment guards',async t=>{
 const app=createApp({dbPath:':memory:',origin:'http://localhost:3000'});await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));
 const base='http://127.0.0.1:'+app.address().port;
 let cookie='';async function request(path,body,method){const res=await fetch(base+'/api/'+path,{method:method||(body?'POST':'GET'),headers:{Origin:'http://localhost:3000',Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')};}
 assert.equal((await request('dashboard')).status,401);
 assert.equal((await request('auth/register',{name:'Maker',email:'maker@example.com',password:'short'})).status,400);
 let r=await request('auth/register',{name:'Maker',email:'maker@example.com',password:'a-long-password-123'});assert.equal(r.status,200);assert.match(r.cookie,/HttpOnly/);cookie=r.cookie.split(';')[0];
 const user=(await request('me')).body.user;assert.equal(user.name,'Maker');assert.equal(user.password,undefined);
 r=await request('records',{kind:'profile',name:"Maker's Studio",category:'Design',location:'Atlanta',specialty:'Brand design',price:'mid'});assert.equal(r.status,200);const profile=r.body.id;
 r=await request('records',{kind:'profile',id:profile,name:'<script>',category:'Design',location:'Atlanta',specialty:'bad'});assert.equal(r.status,400);
 r=await request('records',{kind:'product',name:'Design Kit',type:'Templates',lane:'Design',price:12.34,description:'Original templates',download:'https://example.com/private.zip'});assert.equal(r.status,200);const product=r.body.id;
 const catalog=(await request('catalog')).body;assert.equal(catalog.find(p=>p.id===product).download,undefined);assert.equal(catalog.find(p=>p.id===product).price,12.34);
 assert.equal((await request('checkout',{product})).status,400);
 assert.equal((await request('download/unpaid')).status,403);
 await request('auth/logout',{});assert.equal((await request('dashboard')).status,401);
 r=await request('auth/register',{name:'Buyer',email:'buyer@example.com',password:'another-password-123'});cookie=r.cookie.split(';')[0];
 assert.equal((await request('records/'+product,null,'DELETE')).status,403);
 assert.equal((await request('records',{kind:'profile',id:profile,name:'Imposter',category:'Design',location:'NY',specialty:'No'})).status,403);
 assert.equal((await request('checkout',{product})).status,409);
 assert.equal((await request('records',{kind:'booking',recipient:profile,text:'Project request'})).status,200);
 assert.equal((await request('bookings')).body.length,0);
 const forbidden=await fetch(base+'/api/auth/logout',{method:'POST',headers:{Origin:'https://evil.example'}});assert.equal(forbidden.status,403);
 const env=process.env.STRIPE_WEBHOOK_SECRET;process.env.STRIPE_WEBHOOK_SECRET='whsec_test';assert.equal((await request('stripe/webhook',{id:'fake'})).status,400);if(env)process.env.STRIPE_WEBHOOK_SECRET=env;else delete process.env.STRIPE_WEBHOOK_SECRET;
 const blocked=await fetch(base+'/.env');assert.equal(blocked.status,404);
});
test('Stripe test checkout, signed fulfillment, replay safety, and buyer-only delivery',async t=>{
 const originalFetch=globalThis.fetch;const oldKey=process.env.STRIPE_SECRET_KEY,oldHook=process.env.STRIPE_WEBHOOK_SECRET;
 process.env.STRIPE_SECRET_KEY='sk_test_fake';process.env.STRIPE_WEBHOOK_SECRET='whsec_fake';let checkoutParams;
 globalThis.fetch=async(url,opts)=>{if(String(url).startsWith('https://api.stripe.com/')){const path=String(url).split('/v1/')[1];let result;if(path==='accounts')result={id:'acct_test'};else if(path==='account_links')result={url:'https://connect.stripe.com/test'};else if(path==='accounts/acct_test')result={charges_enabled:true,payouts_enabled:true};else if(path==='checkout/sessions'){checkoutParams=new URLSearchParams(opts.body);result={id:'cs_test_session',url:'https://checkout.stripe.com/test'};}else throw Error('Unexpected Stripe request');return new Response(JSON.stringify(result),{status:200});}return originalFetch(url,opts);};
 const app=createApp({dbPath:':memory:',origin:'http://localhost:3000'});await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(async()=>{globalThis.fetch=originalFetch;if(oldKey)process.env.STRIPE_SECRET_KEY=oldKey;else delete process.env.STRIPE_SECRET_KEY;if(oldHook)process.env.STRIPE_WEBHOOK_SECRET=oldHook;else delete process.env.STRIPE_WEBHOOK_SECRET;await new Promise(r=>app.close(r));});const base='http://127.0.0.1:'+app.address().port;let cookie='';
 async function req(path,data){const res=await fetch(base+'/api/'+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000',Cookie:cookie,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')};}
 let r=await req('auth/register',{email:'seller@test.example',password:'seller-password-123',name:'Seller'});cookie=r.cookie.split(';')[0];const sellerCookie=cookie;
 await req('records',{kind:'profile',name:'Seller',category:'Design',location:'Remote',specialty:'Templates'});
 r=await req('records',{kind:'product',name:'Kit',description:'Original kit',type:'Templates',lane:'Design',price:19.99,download:'https://example.com/private-kit.zip'});const product=r.data.id;
 assert.equal((await req('connect',{})).status,200);
 r=await req('auth/register',{email:'buyer@test.example',password:'buyer-password-123',name:'Buyer'});cookie=r.cookie.split(';')[0];
 assert.equal((await req('checkout',{product,price:0.01})).status,200);assert.equal(checkoutParams.get('line_items[0][price_data][unit_amount]'),'1999');assert.equal(checkoutParams.get('payment_intent_data[transfer_data][destination]'),'acct_test');
 const order=(await req('dashboard')).data.orders[0];assert.equal(order.status,'pending');assert.equal((await req('download/'+order.id)).status,403);
 const event={id:'evt_test',livemode:false,type:'checkout.session.completed',data:{object:{id:'cs_test_session',mode:'payment',payment_status:'paid',currency:'usd',amount_total:1999,metadata:{order:order.id,user:order.buyer}}}};
 const raw=JSON.stringify(event),timestamp=Math.floor(Date.now()/1000),signature=createHmac('sha256','whsec_fake').update(timestamp+'.'+raw).digest('hex');
 for(let i=0;i<2;i++){const res=await fetch(base+'/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':`t=${timestamp},v1=${signature}`},body:raw});assert.equal(res.status,200);}
 assert.equal((await req('dashboard')).data.orders[0].status,'paid');
 let download=await fetch(base+'/api/download/'+order.id,{headers:{Cookie:cookie},redirect:'manual'});assert.equal(download.status,302);assert.equal(download.headers.get('location'),'https://example.com/private-kit.zip');cookie=sellerCookie;assert.equal((await req('download/'+order.id)).status,403);
});
test('email verification and single-use password recovery invalidate old sessions',async t=>{
 const mail=[];const app=createApp({dbPath:':memory:',origin:'http://localhost:3000',mailer:async m=>mail.push(m)});await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>app.close(r)));const base='http://127.0.0.1:'+app.address().port;let cookie='';
 async function req(path,data){const res=await fetch(base+'/api/'+path,{method:data?'POST':'GET',headers:{Origin:'http://localhost:3000',Cookie:cookie,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')};}
 let r=await req('auth/register',{name:'Maker',email:'reset@example.test',password:'original-password-123'});cookie=r.cookie.split(';')[0];assert.equal((await req('me')).data.user.verified,false);
 await req('auth/request-verification',{});let token=mail.at(-1).text.match(/token=([a-f0-9]+)/)[1];assert.equal((await req('auth/verify',{token})).status,200);assert.equal((await req('me')).data.user.verified,true);assert.equal((await req('auth/verify',{token})).status,400);
 const unknown=await req('auth/request-reset',{email:'unknown@example.test'});const known=await req('auth/request-reset',{email:'reset@example.test'});assert.deepEqual(known.data,unknown.data);
 token=mail.at(-1).text.match(/token=([a-f0-9]+)/)[1];assert.equal((await req('auth/reset',{token,password:'new-password-1234'})).status,200);assert.equal((await req('me')).data.user,null);assert.equal((await req('auth/reset',{token,password:'another-password-1234'})).status,400);assert.equal((await req('auth/login',{email:'reset@example.test',password:'original-password-123'})).status,401);assert.equal((await req('auth/login',{email:'reset@example.test',password:'new-password-1234'})).status,200);
});
test('accounts and sessions persist across a server restart',async t=>{
 const folder=mkdtempSync(join(tmpdir(),'weallcreate-test-')),path=join(folder,'test.sqlite');let app;
 t.after(async()=>{if(app?.listening)await new Promise(r=>app.close(r));for(const suffix of ['','-wal','-shm'])try{unlinkSync(path+suffix);}catch(e){if(e.code!=='ENOENT')throw e;}rmdirSync(folder);});
 async function start(){app=createApp({dbPath:path,origin:'http://localhost:3000'});await new Promise(r=>app.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+app.address().port;}
 let base=await start();const registered=await fetch(base+'/api/auth/register',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({name:'Persistent Maker',email:'persist@example.test',password:'persistent-password-123'})});assert.equal(registered.status,200);const cookie=registered.headers.get('set-cookie').split(';')[0];await new Promise(r=>app.close(r));base=await start();const me=await fetch(base+'/api/me',{headers:{Cookie:cookie}});assert.equal((await me.json()).user.name,'Persistent Maker');
});
test('subscriptions reuse pending checkout and track verified lifecycle events; live keys are rejected',async t=>{
 const originalFetch=globalThis.fetch,old={key:process.env.STRIPE_SECRET_KEY,hook:process.env.STRIPE_WEBHOOK_SECRET,price:process.env.STRIPE_PRICE_ID};process.env.STRIPE_SECRET_KEY='sk_test_subscription';process.env.STRIPE_WEBHOOK_SECRET='whsec_subscription';process.env.STRIPE_PRICE_ID='price_test_creator';let checkoutCalls=0,subscriptionStatus='active',userId;
 globalThis.fetch=async(url,opts)=>{if(String(url).startsWith('https://api.stripe.com/')){const path=String(url).split('/v1/')[1];let data;if(path==='checkout/sessions'){checkoutCalls++;assert.equal(new URLSearchParams(opts.body).get('mode'),'subscription');data={id:'cs_subscription',url:'https://checkout.stripe.com/subscription'};}else if(path==='subscriptions/sub_test')data={id:'sub_test',customer:'cus_test',status:subscriptionStatus,metadata:{user:userId}};else if(path==='billing_portal/sessions'){assert.equal(new URLSearchParams(opts.body).get('customer'),'cus_test');data={url:'https://billing.stripe.com/test'};}else throw Error('Unexpected Stripe request');return new Response(JSON.stringify(data));}return originalFetch(url,opts);};
 const app=createApp({dbPath:':memory:'});await new Promise(r=>app.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.close(r));globalThis.fetch=originalFetch;for(const [k,v]of [['STRIPE_SECRET_KEY',old.key],['STRIPE_WEBHOOK_SECRET',old.hook],['STRIPE_PRICE_ID',old.price]])if(v===undefined)delete process.env[k];else process.env[k]=v;});const base='http://127.0.0.1:'+app.address().port;let cookie='';async function req(path,body){const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{Origin:'http://localhost:3000',Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};}
 let r=await req('auth/register',{name:'Subscriber',email:'subscriber@example.test',password:'subscriber-password-123'});cookie=r.cookie.split(';')[0];userId=(await req('me')).data.user.id;assert.equal((await req('checkout',{subscription:true})).status,200);assert.equal((await req('checkout',{subscription:true})).status,200);assert.equal(checkoutCalls,1);
 async function event(status,id,type='customer.subscription.updated'){subscriptionStatus=status;const raw=JSON.stringify({id,livemode:false,type,data:{object:{id:'sub_test'}}}),ts=Math.floor(Date.now()/1000),sig=createHmac('sha256','whsec_subscription').update(ts+'.'+raw).digest('hex');return fetch(base+'/api/stripe/webhook',{method:'POST',body:raw,headers:{'stripe-signature':`t=${ts},v1=${sig}`}});}
 assert.equal((await event('active','evt_active','customer.subscription.created')).status,200);assert.equal((await req('me')).data.user.subscription,'active');assert.equal((await req('checkout',{subscription:true})).status,409);assert.equal((await req('billing',{})).status,200);await event('past_due','evt_past_due');assert.equal((await req('me')).data.user.subscription,'past_due');await event('canceled','evt_canceled','customer.subscription.deleted');assert.equal((await req('me')).data.user.subscription,'canceled');process.env.STRIPE_SECRET_KEY='sk_live_forbidden';assert.equal((await req('connect',{})).status,503);
});
