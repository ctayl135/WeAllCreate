import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initFeatures } from './features.mjs';
import { scheduleBackups } from './backups.mjs';
import { isIP } from 'node:net';
const root = dirname(fileURLToPath(import.meta.url));
const hash = x => createHash('sha256').update(x).digest('hex');
const derive = promisify(scrypt);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const text = (v, max=200) => { if(typeof v !== 'string' || !v.trim() || v.length>max || /[<>\x00-\x08]/.test(v)) fail(400,'Please provide valid text (no HTML).'); return v.trim(); };
const image = v => { if(!v||v==='/weallcreate-logo.png') return '/weallcreate-logo.png';if(/^\/api\/files\/[a-f0-9-]{36}$/.test(v))return v;let u;try{u=new URL(v);}catch{fail(400,'Enter a valid HTTPS image URL.');}if(u.protocol!=='https:') fail(400,'Image must use HTTPS.');return u.href; };
export function createApp(options={}) {
 const origin=options.origin || process.env.APP_ORIGIN || 'http://localhost:3000';
 if(process.env.NODE_ENV==='production' && !origin.startsWith('https://')) throw Error('Production APP_ORIGIN must use HTTPS');
 const path=options.dbPath || process.env.DATABASE_PATH || join(root,'data/weallcreate.sqlite');
 if(path!==':memory:') mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path); db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,name TEXT NOT NULL,account TEXT,customer TEXT,subscription TEXT DEFAULT 'none');
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,owner TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,buyer TEXT NOT NULL REFERENCES users(id),seller TEXT NOT NULL,product TEXT NOT NULL,amount INTEGER NOT NULL,status TEXT DEFAULT 'pending',session TEXT);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY);`);
 const query=(sql,...args)=>db.prepare(sql).get(...args);
 const all=(sql,...args)=>db.prepare(sql).all(...args);
 const run=(sql,...args)=>db.prepare(sql).run(...args);
 if(!all('PRAGMA table_info(orders)').some(c=>c.name==='delivery')) db.exec("ALTER TABLE orders ADD COLUMN delivery TEXT");
 if(!all('PRAGMA table_info(users)').some(c=>c.name==='verified')) db.exec('ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0');
 db.exec('CREATE TABLE IF NOT EXISTS auth_tokens(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),purpose TEXT NOT NULL,expires INTEGER NOT NULL)');
 db.exec('CREATE TABLE IF NOT EXISTS subscription_checkouts(user_id TEXT PRIMARY KEY,request_id TEXT NOT NULL,url TEXT,expires INTEGER NOT NULL)');
 const features=initFeatures({db,dbPath:path,options});
 const stopBackups=scheduleBackups(db,path,features.uploadDir);
 async function mail(to,subject,message) {
  if(options.mailer) return options.mailer({to,subject,text:message});
  if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM) fail(503,'Email delivery is not configured. Contact the site owner.');
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject,text:message}),signal:AbortSignal.timeout(15000)});if(!r.ok) fail(502,'Email delivery failed. Please try again.');
 }
 async function authMail(account,purpose) {const token=randomBytes(32).toString('hex');run('DELETE FROM auth_tokens WHERE expires<? OR (user_id=? AND purpose=?)',Date.now(),account.id,purpose);run('INSERT INTO auth_tokens VALUES(?,?,?,?)',hash(token),account.id,purpose,Date.now()+30*60000);await mail(account.email,purpose==='reset'?'Reset your WeAllCreate password':'Verify your WeAllCreate email',`Open this link within 30 minutes: ${origin}/#${purpose==='reset'?'reset-password':'verify-email'}?token=${token}\nIf you did not request this, ignore this email.`);}
 const rates=new Map();
 async function stripe(endpoint,params,method='POST',key) {
  const secret=process.env.STRIPE_SECRET_KEY || ''; if(!secret.startsWith('sk_test_')) fail(503,'Stripe test mode is not configured.');
  const response=await fetch('https://api.stripe.com/v1/'+endpoint,{method,headers:{Authorization:`Bearer ${secret}`,...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...(key?{'Idempotency-Key':key}:{})},body:method==='POST'?new URLSearchParams(params):undefined,signal:AbortSignal.timeout(15000)});
  const data=await response.json(); if(!response.ok) { console.error('Stripe request failed:',data.error?.code); fail(502,'Payment provider could not complete the request.'); } return data;
 }
 async function subscribe(user) {
  if(!process.env.STRIPE_PRICE_ID) fail(503,'Subscription price is not configured');
  if(['active','trialing','past_due','unpaid','incomplete','paused'].includes(user.subscription))fail(409,'A subscription already exists. Use Manage billing.');
  run('DELETE FROM subscription_checkouts WHERE user_id=? AND expires<?',user.id,Date.now());
  const existing=query('SELECT * FROM subscription_checkouts WHERE user_id=?',user.id);if(existing){if(existing.url)return existing.url;fail(409,'Checkout is being prepared. Try again shortly.');}
  const id=randomUUID(),expires=Math.floor(Date.now()/1000)+31*60;run('INSERT INTO subscription_checkouts VALUES(?,?,NULL,?)',user.id,id,expires*1000);
  try{const s=await stripe('checkout/sessions',{mode:'subscription',expires_at:String(expires),'line_items[0][price]':process.env.STRIPE_PRICE_ID,'line_items[0][quantity]':'1','metadata[user]':user.id,'subscription_data[metadata][user]':user.id,...(user.customer?{customer:user.customer}:{customer_email:user.email}),success_url:origin+'/?checkout=success#dashboard',cancel_url:origin+'/?checkout=cancelled#dashboard'},'POST',id);run('UPDATE subscription_checkouts SET url=? WHERE user_id=?',s.url,user.id);return s.url;}catch(e){run('DELETE FROM subscription_checkouts WHERE user_id=?',user.id);throw e;}
 }
 const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'");
  if(process.env.NODE_ENV==='production') res.setHeader('Strict-Transport-Security','max-age=31536000');
  try {
   const url=new URL(req.url,origin), route=url.pathname, method=req.method;
   if(!route.startsWith('/api/')) { if(!['GET','HEAD'].includes(method)) fail(405,'Method not allowed');const files={'/':'index.html','/app.js':'app.js','/features-ui.js':'features-ui.js','/legacy.js':'legacy.js','/site.css':'site.css','/weallcreate-logo.png':'weallcreate-logo.png'};if(!files[route]) fail(404,'Not found');res.setHeader('Content-Type',route.endsWith('.png')?'image/png':route.endsWith('.js')?'text/javascript':route.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(method==='HEAD'?undefined:readFileSync(join(root,files[route])));return; }
   if(method!=='GET' && route!=='/api/stripe/webhook' && req.headers.origin!==origin) fail(403,'Request origin not allowed.');
   if(route==='/api/uploads'){const session=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('wac_session='))?.slice(12);if(!session||!query('SELECT token FROM sessions WHERE token=? AND expires>?',hash(session),Date.now()))fail(401,'Please sign in before uploading.');}
   const clientHeader=process.env.TRUST_PROXY==='railway'?req.headers['x-real-ip']:process.env.TRUST_PROXY==='caddy'?String(req.headers['x-forwarded-for']||'').split(',').at(-1)?.trim():null;
   const ip=typeof clientHeader==='string'&&isIP(clientHeader)?clientHeader:req.socket.remoteAddress;const now=Date.now();if(rates.size>10000) for(const [k,v] of rates) if(v.until<now) rates.delete(k);
   const rateKey=ip+(route.includes('/auth/')?':auth':':api');let rate=rates.get(rateKey);if(!rate||rate.until<now) rates.set(rateKey,rate={n:0,until:now+60000});if(++rate.n>(route.includes('/auth/')?20:240)) fail(429,'Too many requests. Try again shortly.');
   const chunks=[];let size=0;const limit=route==='/api/uploads'?17*1024*1024:65536;for await (const chunk of req) {size+=chunk.length;if(size>limit) fail(413,'Request too large.');chunks.push(chunk);}const raw=Buffer.concat(chunks).toString('utf8');
   if(route==='/api/stripe/webhook' && method==='POST') {
    const secret=process.env.STRIPE_WEBHOOK_SECRET;if(!secret) fail(503,'Webhook not configured');
    const parts=(req.headers['stripe-signature']||'').split(',');const timestamp=parts.find(x=>x.startsWith('t='))?.slice(2);const expected=createHmac('sha256',secret).update(timestamp+'.'+raw).digest('hex');
    if(!timestamp||Math.abs(now/1000-Number(timestamp))>300||!parts.filter(x=>x.startsWith('v1=')).some(x=>{const b=Buffer.from(x.slice(3),'hex');return b.length===32&&timingSafeEqual(b,Buffer.from(expected,'hex'));})) fail(400,'Invalid webhook signature');
    const event=JSON.parse(raw);if(event.livemode!==false) fail(400,'Only test events accepted');if(query('SELECT id FROM events WHERE id=?',event.id)) return send(200,{received:true});
    const obj=event.data.object;
    if(event.type==='checkout.session.completed' || event.type==='checkout.session.async_payment_succeeded') {
     if(obj.mode==='payment' && obj.payment_status==='paid' && obj.currency==='usd') run("UPDATE orders SET status='paid',session=?,payment_intent=? WHERE id=? AND amount=? AND buyer=? AND (session IS NULL OR session=?) AND status IN ('pending','failed')",obj.id,obj.payment_intent||null,obj.metadata?.order||'',obj.amount_total,obj.metadata?.user||'',obj.id);
     if(obj.mode==='subscription' && obj.customer) run('UPDATE users SET customer=? WHERE id=?',obj.customer,obj.metadata?.user||'');
    }
    if(event.type==='checkout.session.async_payment_failed')run("UPDATE orders SET status='failed' WHERE session=? AND status='pending'",obj.id);
    if(event.type==='checkout.session.expired')run("UPDATE orders SET status='expired' WHERE session=? AND status='pending'",obj.id);
    if(event.type==='charge.dispute.created')run("UPDATE orders SET status='disputed' WHERE payment_intent=?",obj.payment_intent);
    if(event.type==='charge.refunded') {const sessions=await stripe('checkout/sessions?payment_intent='+encodeURIComponent(obj.payment_intent),{},'GET');for(const s of sessions.data||[]) run("UPDATE orders SET status='refunded' WHERE session=?",s.id);}
    if(event.type.startsWith('customer.subscription.')) {
     const sub=await stripe('subscriptions/'+encodeURIComponent(obj.id),{},'GET');
     run('UPDATE users SET subscription=?,customer=? WHERE id=?',sub.status,sub.customer,sub.metadata?.user||'');
    }
    run('INSERT INTO events(id) VALUES(?)',event.id);return send(200,{received:true});
   }
   let body={};if(raw) {try {body=JSON.parse(raw);} catch {fail(400,'Invalid JSON');}if(!body||Array.isArray(body)||typeof body!=='object')fail(400,'Expected a JSON object.');}
   const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('wac_session='))?.slice(12);
   const user=token?query('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?',hash(token),now):null;
   const auth=()=>{if(!user) fail(401,'Please sign in first.');return user;};
   if(await features.handle({route,method,body,user,auth,send,res,url}))return;
   if(route==='/api/auth/request-reset'&&method==='POST') {if(!options.mailer&&(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)) fail(503,'Email delivery is not configured. Contact the site owner.');const account=query('SELECT * FROM users WHERE email=?',text(body.email,254).toLowerCase());if(account)await authMail(account,'reset');return send(200,{ok:true,message:'If that account exists, a reset email is on its way.'});}
   if(route==='/api/auth/request-verification'&&method==='POST') {auth();await authMail(user,'verify');return send(200,{ok:true});}
   if((route==='/api/auth/reset'||route==='/api/auth/verify')&&method==='POST') {const purpose=route.endsWith('/reset')?'reset':'verify';const ticket=query('SELECT * FROM auth_tokens WHERE token=? AND purpose=? AND expires>?',hash(String(body.token||'')),purpose,now);if(!ticket)fail(400,'This link is invalid or expired. Request a new one.');let password;if(purpose==='reset'){if(typeof body.password!=='string'||body.password.length<12||body.password.length>128)fail(400,'Use a password of 12–128 characters.');const salt=randomBytes(16).toString('hex');password=salt+':'+(await derive(body.password,salt,64)).toString('hex');}
    db.exec('BEGIN IMMEDIATE');try{const removed=run('DELETE FROM auth_tokens WHERE token=?',ticket.token);if(!removed.changes)fail(400,'This link has already been used.');if(purpose==='verify')run('UPDATE users SET verified=1 WHERE id=?',ticket.user_id);else{run('UPDATE users SET password=? WHERE id=?',password,ticket.user_id);run('DELETE FROM sessions WHERE user_id=?',ticket.user_id);run('DELETE FROM auth_tokens WHERE user_id=?',ticket.user_id);}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return send(200,{ok:true});}
   if(route==='/api/auth/register'||route==='/api/auth/login') {
    if(method!=='POST') fail(405,'Method not allowed');
    const email=text(body.email,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400,'Enter a valid email.');
    if(typeof body.password!=='string'||body.password.length<12||body.password.length>128) fail(400,'Use a password of 12–128 characters.');
    let account=query('SELECT * FROM users WHERE email=?',email);
    if(route.endsWith('register')) {if(account) fail(409,'An account already exists for this email.');const salt=randomBytes(16).toString('hex');const password=(await derive(body.password,salt,64)).toString('hex');const id=randomUUID();run('INSERT INTO users(id,email,password,name) VALUES(?,?,?,?)',id,email,salt+':'+password,text(body.name,80));account=query('SELECT * FROM users WHERE id=?',id);}
    else {const [salt,stored]=(account?.password||'invalid:'+ '0'.repeat(128)).split(':');const actual=await derive(body.password,salt,64);if(!account||!timingSafeEqual(actual,Buffer.from(stored,'hex'))) fail(401,'Incorrect email or password.');}
    const value=randomBytes(32).toString('hex');run('DELETE FROM sessions WHERE expires<?',now);run('INSERT INTO sessions VALUES(?,?,?)',hash(value),account.id,now+7*86400000);
    res.setHeader('Set-Cookie',`wac_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${origin.startsWith('https:')?'; Secure':''}`);return send(200,{ok:true});
   }
   if(route==='/api/auth/logout'&&method==='POST') {if(token) run('DELETE FROM sessions WHERE token=?',hash(token));res.setHeader('Set-Cookie','wac_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return send(200,{ok:true});}
   if(route==='/api/me'&&method==='GET') return send(200,{user:user?{id:user.id,name:user.name,email:user.email,verified:!!user.verified,admin:features.isAdmin(user),subscription:user.subscription,connected:!!user.account}:null});
   if(route==='/api/catalog'&&method==='GET') return send(200,all("SELECT r.id,r.kind,r.owner,r.body FROM records r JOIN users u ON u.id=r.owner WHERE r.kind IN ('profile','product','post','collab','portfolio') AND r.hidden=0 AND u.suspended=0 ORDER BY r.rowid DESC LIMIT 1000").map(r=>{const data=JSON.parse(r.body);delete data.download;return {...data,id:r.id,kind:r.kind,owner:r.owner};}));
   if(route==='/api/dashboard'&&method==='GET') {auth();return send(200,{records:all('SELECT * FROM records WHERE owner=?',user.id).map(r=>({...JSON.parse(r.body),id:r.id,kind:r.kind})),orders:all('SELECT id,product,amount,status,buyer,seller,name,kind,created FROM orders WHERE buyer=? OR seller=?',user.id,user.id)});}
   if(route==='/api/records'&&method==='POST') {
    if(user&&process.env.NODE_ENV==='production'&&!user.verified)fail(403,'Verify your email before publishing content.');
    auth();const kind=body.kind;let data;
    if(kind==='profile') {data={name:text(body.name,80),category:text(body.category),lane:text(body.category),location:text(body.location),price:['budget','mid','premium'].includes(body.price)?body.price:'mid',specialty:text(body.specialty,3000),image:image(body.image),available:body.available!==false&&body.available!=='false'};if(query("SELECT id FROM records WHERE kind='profile' AND owner=? AND id!=?",user.id,body.id||'')) fail(409,'Edit your existing profile in the dashboard.');}
    else if(kind==='product') {const profile=query("SELECT body FROM records WHERE kind='profile' AND owner=?",user.id);if(!profile) fail(400,'Create your profile first.');const price=Number(body.price);if(!Number.isFinite(price)||price<0.5||price>10000) fail(400,'Price must be $0.50–$10,000.');const fulfillment=body.fulfillment==='service'?'service':'digital';let download='';if(fulfillment==='digital'){if(String(body.download).startsWith('file:')){features.ownedFile(body.download.slice(5),user.id,'private');download=body.download;}else{let u;try{u=new URL(body.download);}catch{fail(400,'Upload a delivery file or provide an HTTPS delivery URL.');}if(u.protocol!=='https:')fail(400,'Download must use HTTPS.');if(process.env.NODE_ENV==='production')fail(400,'Upload a private delivery file for production listings.');download=u.href;}}data={name:text(body.name),creator:JSON.parse(profile.body).name,type:text(body.type),lane:text(body.lane),fulfillment,price:Math.round(price*100)/100,description:text(body.description,3000),image:image(body.image),download};}
    else if(kind==='portfolio'){if(!query("SELECT id FROM records WHERE owner=? AND kind='profile'",user.id))fail(400,'Create your profile first.');data={title:text(body.title),description:text(body.description,3000),image:image(body.image),category:text(body.category)};}
    else if(kind==='post') data={author:user.name,tag:text(body.tag),text:text(body.text,3000),stats:'0 likes · 0 comments'};
    else if(kind==='collab') data={title:text(body.title),description:text(body.description||body.title,3000),author:user.name,tag:text(body.tag),status:['Open','In Progress','Completed'].includes(body.status)?body.status:'Open'};
    else if(kind==='booking') {const recipient=query("SELECT r.owner FROM records r JOIN users u ON u.id=r.owner WHERE r.id=? AND r.kind='profile' AND r.hidden=0 AND u.suspended=0",body.recipient);if(!recipient) fail(400,'Select a registered creator.');if(recipient.owner===user.id)fail(400,'Choose another creator for your booking.');data={recipient:recipient.owner,from:user.name,email:user.email,text:text(body.text,3000)};}
    else fail(400,'Unknown record type');
    if(data.image?.startsWith('/api/files/'))features.ownedFile(data.image.split('/').pop(),user.id,'image');
    const id=body.id||randomUUID();if(body.id) {const old=query('SELECT * FROM records WHERE id=?',id);if(!old||old.owner!==user.id||old.kind!==kind) fail(403,'You can only edit your own records.');run('UPDATE records SET body=? WHERE id=?',JSON.stringify(data),id);}else run('INSERT INTO records(id,kind,owner,body) VALUES(?,?,?,?)',id,kind,user.id,JSON.stringify(data));
    if(kind==='profile')for(const r of all("SELECT id,body FROM records WHERE owner=? AND kind='product'",user.id)){const p=JSON.parse(r.body);p.creator=data.name;run('UPDATE records SET body=? WHERE id=?',JSON.stringify(p),r.id);}
    return send(200,{id});
   }
   if(route.startsWith('/api/records/')&&method==='DELETE') {auth();const id=route.split('/').pop();if(query('SELECT owner FROM records WHERE id=?',id)?.owner!==user.id) fail(403,'You can only delete your own records.');run('DELETE FROM records WHERE id=?',id);return send(200,{ok:true});}
   if(route==='/api/bookings'&&method==='GET') {auth();return send(200,all("SELECT id,body FROM records WHERE kind='booking'").map(r=>({id:r.id,...JSON.parse(r.body)})).filter(r=>r.recipient===user.id));}
   if(route==='/api/connect'&&method==='POST') {auth();let account=user.account;if(!account){const a=await stripe('accounts',{'type':'express','email':user.email,'capabilities[transfers][requested]':'true'},'POST','connect-'+user.id);account=a.id;run('UPDATE users SET account=? WHERE id=?',account,user.id);}const link=await stripe('account_links',{account,type:'account_onboarding',refresh_url:origin+'/#dashboard',return_url:origin+'/#dashboard'});return send(200,{url:link.url});}
   if(route==='/api/checkout'&&method==='POST') {
    auth();if(process.env.NODE_ENV==='production'&&!user.verified) fail(403,'Verify your email in the dashboard before checkout.');
    auth();if(body.subscription) return send(200,{url:await subscribe(user)});
    const record=query("SELECT r.* FROM records r JOIN users u ON u.id=r.owner WHERE r.id=? AND r.kind='product' AND r.hidden=0 AND u.suspended=0",body.product);if(!record) fail(404,'This listing is unavailable.');if(record.owner===user.id) fail(400,'You cannot buy your own product.');const seller=query('SELECT account FROM users WHERE id=?',record.owner);if(!seller.account) fail(409,'Seller has not connected payments.');const account=await stripe('accounts/'+seller.account,{},'GET');if(!account.charges_enabled||!account.payouts_enabled) fail(409,'Seller onboarding is incomplete.');const p=JSON.parse(record.body),id=randomUUID(),amount=Math.round(p.price*100);run('INSERT INTO orders(id,buyer,seller,product,amount,name,kind,created) VALUES(?,?,?,?,?,?,?,?)',id,user.id,record.owner,record.id,amount,p.name,p.fulfillment||'digital',Date.now());
    run('UPDATE orders SET delivery=? WHERE id=?',p.download,id);
    const session=await stripe('checkout/sessions',{mode:'payment','payment_method_types[0]':'card','line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(amount),'line_items[0][price_data][product_data][name]':p.name,'line_items[0][quantity]':'1','payment_intent_data[transfer_data][destination]':seller.account,'metadata[order]':id,'metadata[user]':user.id,success_url:origin+'/?checkout=success#dashboard',cancel_url:origin+'/?checkout=cancelled#marketplace'},'POST',id);run('UPDATE orders SET session=? WHERE id=?',session.id,id);return send(200,{url:session.url});
   }
   if(route==='/api/billing'&&method==='POST') {auth();if(!user.customer) fail(400,'No billing account yet.');const s=await stripe('billing_portal/sessions',{customer:user.customer,return_url:origin+'/#dashboard'});return send(200,{url:s.url});}
   if(route.startsWith('/api/download/')&&method==='GET') {auth();const order=query("SELECT * FROM orders WHERE id=? AND buyer=? AND status='paid'",route.split('/').pop(),user.id);if(!order) fail(403,'A confirmed purchase is required.');if(!order.delivery) fail(410,'This is a service order. Contact the creator in Messages.');if(features.download(order,res))return;res.writeHead(302,{Location:order.delivery});return res.end();}
   fail(404,'Not found');
  } catch(error) {const incident=randomUUID();if(!error.status)console.error(JSON.stringify({level:'error',incident,time:new Date().toISOString(),message:error.message,route:req.url?.split('?')[0]}));if(!res.headersSent)send(error.status||500,{error:error.status?error.message:'Unable to complete request. Please try again.',...(!error.status?{incident}:{})});else res.end();}
 });
 server.requestTimeout=30000;server.headersTimeout=15000;server.maxRequestsPerSocket=1000;server.on('close',()=>{stopBackups();db.close();});return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) createApp().listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('WeAllCreate ready on port '+(process.env.PORT||3000)));


