import {randomUUID,randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const clean=(v,max=3000)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[<>\x00-\x08]/.test(v))fail(400,'Enter valid text without HTML.');return v.trim();};
const digest=s=>createHash('sha256').update(s).digest('hex');
export function initFeatures({db,dbPath,options}){
 const get=(s,...v)=>db.prepare(s).get(...v),all=(s,...v)=>db.prepare(s).all(...v),run=(s,...v)=>db.prepare(s).run(...v);
 const addColumn=(table,name,sql)=>{if(!all('PRAGMA table_info('+table+')').some(c=>c.name===name))db.exec('ALTER TABLE '+table+' ADD COLUMN '+name+' '+sql);};
 db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,sender TEXT NOT NULL REFERENCES users(id),recipient TEXT NOT NULL REFERENCES users(id),text TEXT NOT NULL,created INTEGER NOT NULL,read_at INTEGER);
 CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,purpose TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,reporter TEXT NOT NULL REFERENCES users(id),target TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS audit_log(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS interactions(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),target TEXT NOT NULL,kind TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(owner,target,kind));
 CREATE TABLE IF NOT EXISTS site_groups(id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS group_members(group_id TEXT NOT NULL REFERENCES site_groups(id),user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(group_id,user_id));`);
 addColumn('users','suspended','INTEGER NOT NULL DEFAULT 0');addColumn('records','hidden','INTEGER NOT NULL DEFAULT 0');
 addColumn('orders','name',"TEXT NOT NULL DEFAULT ''");addColumn('orders','kind',"TEXT NOT NULL DEFAULT 'digital'");addColumn('orders','created','INTEGER NOT NULL DEFAULT 0');addColumn('orders','payment_intent','TEXT');
 run("INSERT OR IGNORE INTO settings VALUES('download_secret',?)",randomBytes(32).toString('hex'));
 const secret=get("SELECT value FROM settings WHERE key='download_secret'").value;
 const uploadDir=options.uploadDir||join(dbPath===':memory:'?options.testDir||dirname(dbPath):dirname(dbPath),'uploads');
 const adminEmails=()=>String(options.adminEmails||process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 const isAdmin=u=>!!u&&!!u.verified&&adminEmails().includes(u.email);
 const file=id=>get('SELECT * FROM uploads WHERE id=?',id);
 const ownedFile=(id,owner,purpose)=>{const f=file(id);if(!f||f.owner!==owner||(purpose&&f.purpose!==purpose))fail(400,'Choose one of your uploaded files.');return f;};
 const audit=(u,action,target)=>run('INSERT INTO audit_log VALUES(?,?,?,?,?)',randomUUID(),u.id,action,target,Date.now());
 for(const [id,name,description]of [['visual-media','Visual Media','Photography, video and visual storytelling'],['music-audio','Music & Audio','Artists, producers and audio creators'],['design-tech','Design & Tech','Designers, developers and digital makers']])run('INSERT OR IGNORE INTO site_groups VALUES(?,?,?)',id,name,description);
 run('INSERT OR IGNORE INTO schema_migrations VALUES(?,?)',2,new Date().toISOString());
 function sign(order,expires){return createHmac('sha256',secret).update(order.id+':'+order.buyer+':'+order.delivery+':'+expires).digest('hex');}
 function download(order,res){if(!order.delivery?.startsWith('file:'))return false;const id=order.delivery.slice(5),expires=Date.now()+5*60000;res.writeHead(302,{Location:`/api/files/${id}?order=${order.id}&expires=${expires}&signature=${sign(order,expires)}`});res.end();return true;}
 async function handle(c){const {route,method,body,user,auth,send,res,url}=c;
  if(route==='/api/config'&&method==='GET'){send(200,{supportEmail:process.env.SUPPORT_EMAIL||'',paymentsMode:'test'});return true;}
  if(route==='/api/health'&&method==='GET'){get('SELECT 1');send(200,{status:'ok',version:'1.1.0'});return true;}
  if(user?.suspended)fail(403,'This account is suspended. Contact support.');
  if(user&&process.env.NODE_ENV==='production'&&!user.verified&&method!=='GET'&&!route.startsWith('/api/auth/'))fail(403,'Verify your email before using creator features.');
  if(route==='/api/uploads'&&method==='POST'){
   if(user&&process.env.NODE_ENV==='production'&&!user.verified)fail(403,'Verify your email before uploading files.');
   auth();const purpose=body.purpose==='image'?'image':'private';const name=clean(body.name,150);if(typeof body.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(body.data))fail(400,'Invalid file encoding.');const bytes=Buffer.from(body.data,'base64');if(!bytes.length||bytes.length>12*1024*1024)fail(400,'Files must be between 1 byte and 12 MB.');
   let mime;if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')mime='image/webp';else if(bytes.toString('ascii',0,5)==='%PDF-')mime='application/pdf';else if(bytes[0]===80&&bytes[1]===75&&[3,5,7].includes(bytes[2]))mime='application/zip';else fail(400,'Supported files: PNG, JPEG, WebP, PDF and ZIP.');if(purpose==='image'&&!mime.startsWith('image/'))fail(400,'Choose a PNG, JPEG or WebP image.');
   if(get('SELECT coalesce(sum(size),0) AS size FROM uploads WHERE owner=?',user.id).size+bytes.length>120*1024*1024)fail(400,'Your 120 MB storage allowance is full.');
   mkdirSync(uploadDir,{recursive:true});const id=randomUUID();writeFileSync(join(uploadDir,id),bytes,{flag:'wx',mode:0o600});run('INSERT INTO uploads VALUES(?,?,?,?,?,?,?)',id,user.id,name,mime,bytes.length,purpose,Date.now());send(200,{id,name,mime,url:purpose==='image'?'/api/files/'+id:undefined,delivery:purpose==='private'?'file:'+id:undefined});return true;
  }
  if(route.startsWith('/api/files/')&&method==='GET'){
   const f=file(route.split('/').pop());if(!f||get('SELECT suspended FROM users WHERE id=?',f.owner)?.suspended)fail(404,'File not found');let access=f.purpose==='image'||user?.id===f.owner;
   if(!access){auth();const o=get("SELECT * FROM orders WHERE id=? AND buyer=? AND status='paid'",url.searchParams.get('order'),user.id);const expires=Number(url.searchParams.get('expires')),provided=Buffer.from(url.searchParams.get('signature')||'','hex');access=!!o&&o.delivery==='file:'+f.id&&expires>Date.now()&&expires<Date.now()+6*60000&&provided.length===32&&timingSafeEqual(provided,Buffer.from(sign(o,expires),'hex'));}if(!access)fail(403,'A valid, unexpired buyer download is required.');
   const path=join(uploadDir,f.id);if(!existsSync(path))fail(410,'File unavailable. Contact support.');res.setHeader('Content-Type',f.mime);res.setHeader('Content-Length',f.size);res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");res.setHeader('Content-Disposition',`${f.purpose==='image'?'inline':'attachment'}; filename="download"; filename*=UTF-8''${encodeURIComponent(f.name)}`);res.end(readFileSync(path));return true;
  }
  if(route==='/api/my-files'&&method==='GET'){auth();send(200,all('SELECT id,name,mime,purpose,size FROM uploads WHERE owner=? ORDER BY created DESC',user.id));return true;}
  if(route==='/api/messages'&&method==='GET'){
   auth();const peer=url.searchParams.get('peer');if(peer){if(!get('SELECT id FROM users WHERE id=? AND suspended=0',peer))fail(404,'Creator not found');run('UPDATE messages SET read_at=? WHERE recipient=? AND sender=? AND read_at IS NULL',Date.now(),user.id,peer);send(200,all('SELECT id,sender,recipient,text,created,read_at FROM messages WHERE (sender=? AND recipient=?) OR (recipient=? AND sender=?) ORDER BY created DESC LIMIT 200',user.id,peer,user.id,peer).reverse());}
   else send(200,all(`SELECT m.id,m.sender,m.recipient,m.text,m.created,m.read_at,u.name AS peer_name,u.id AS peer FROM messages m JOIN users u ON u.id=CASE WHEN m.sender=? THEN m.recipient ELSE m.sender END WHERE m.sender=? OR m.recipient=? ORDER BY m.created DESC LIMIT 300`,user.id,user.id,user.id));return true;
  }
  if(route==='/api/messages'&&method==='POST'){auth();const recipient=get('SELECT * FROM users WHERE id=? AND suspended=0',body.recipient);if(!recipient||recipient.id===user.id)fail(400,'Select another registered creator.');const id=randomUUID();run('INSERT INTO messages VALUES(?,?,?,?,?,NULL)',id,user.id,recipient.id,clean(body.text),Date.now());send(200,{id});return true;}
  if(route==='/api/community'&&method==='GET'){
   const posts=all("SELECT r.*,u.name AS author FROM records r JOIN users u ON u.id=r.owner WHERE r.kind='post' AND r.hidden=0 AND u.suspended=0 ORDER BY r.rowid DESC LIMIT 100").map(r=>({id:r.id,owner:r.owner,author:r.author,...JSON.parse(r.body),likes:get("SELECT count(*) AS n FROM interactions WHERE target=? AND kind='like'",r.id).n,liked:!!user&&!!get("SELECT id FROM interactions WHERE owner=? AND target=? AND kind='like'",user.id,r.id),comments:all("SELECT i.id,i.body,u.name AS author FROM interactions i JOIN users u ON u.id=i.owner WHERE target=? AND kind LIKE 'comment:%' ORDER BY created LIMIT 50",r.id).map(i=>({id:i.id,author:i.author,text:JSON.parse(i.body).text}))}));send(200,posts);return true;
  }
  if(route==='/api/interactions'&&method==='POST'){
   auth();const target=get('SELECT * FROM records WHERE id=? AND hidden=0',body.target);if(!target)fail(404,'Content not found');const kind=body.kind;
   if(kind==='like'){const prior=get("SELECT id FROM interactions WHERE owner=? AND target=? AND kind='like'",user.id,target.id);if(prior)run('DELETE FROM interactions WHERE id=?',prior.id);else run('INSERT INTO interactions VALUES(?,?,?,?,?,?)',randomUUID(),user.id,target.id,kind,'{}',Date.now());}
   else if(kind==='comment'){run('INSERT INTO interactions VALUES(?,?,?,?,?,?)',randomUUID(),user.id,target.id,'comment:'+randomUUID(),JSON.stringify({text:clean(body.text,1000)}),Date.now());}
   else if(kind==='apply'){if(target.owner===user.id)fail(400,'You own this collaboration.');run('INSERT OR IGNORE INTO interactions VALUES(?,?,?,?,?,?)',randomUUID(),user.id,target.id,'apply',JSON.stringify({text:clean(body.text,1000)}),Date.now());}
   else fail(400,'Unknown action');send(200,{ok:true});return true;
  }
  if(route==='/api/groups'&&method==='GET'){send(200,all('SELECT * FROM site_groups').map(g=>({...g,members:get('SELECT count(*) AS n FROM group_members WHERE group_id=?',g.id).n,joined:!!user&&!!get('SELECT user_id FROM group_members WHERE group_id=? AND user_id=?',g.id,user.id)})));return true;}
  if(route==='/api/groups/join'&&method==='POST'){auth();if(!get('SELECT id FROM site_groups WHERE id=?',body.group))fail(404,'Group not found');const joined=get('SELECT user_id FROM group_members WHERE group_id=? AND user_id=?',body.group,user.id);if(joined)run('DELETE FROM group_members WHERE group_id=? AND user_id=?',body.group,user.id);else run('INSERT INTO group_members VALUES(?,?)',body.group,user.id);send(200,{ok:true});return true;}
  if(route==='/api/reviews'&&method==='GET'){send(200,all("SELECT r.id,r.body,u.name AS author FROM records r JOIN users u ON u.id=r.owner WHERE r.kind='review' AND r.hidden=0 ORDER BY r.rowid DESC LIMIT 100").map(r=>({id:r.id,author:r.author,...JSON.parse(r.body)})));return true;}
  if(route==='/api/reviews'&&method==='POST'){auth();const order=get("SELECT * FROM orders WHERE id=? AND buyer=? AND status='paid'",body.order,user.id);if(!order)fail(403,'Only confirmed buyers can leave a review.');if(!Number.isInteger(body.rating)||body.rating<1||body.rating>5)fail(400,'Choose 1–5 stars');if(get("SELECT id FROM records WHERE kind='review' AND json_extract(body,'$.order')=?",order.id))fail(409,'This order already has a review.');const id=randomUUID();run('INSERT INTO records(id,kind,owner,body) VALUES(?,?,?,?)',id,'review',user.id,JSON.stringify({order:order.id,seller:order.seller,product:order.product,name:order.name,rating:body.rating,text:clean(body.text,2000)}));send(200,{id});return true;}
  if(route==='/api/reports'&&method==='POST'){auth();if(!get('SELECT id FROM records WHERE id=?',body.target)&&!get('SELECT id FROM users WHERE id=?',body.target))fail(404,'Content not found');const id=randomUUID();run('INSERT INTO reports(id,reporter,target,reason,created) VALUES(?,?,?,?,?)',id,user.id,body.target,clean(body.reason,1000),Date.now());send(200,{id});return true;}
  if(route==='/api/admin'&&method==='GET'){
   auth();if(!isAdmin(user))fail(403,'Administrator access required.');send(200,{users:all('SELECT id,name,email,verified,suspended,subscription FROM users ORDER BY rowid DESC LIMIT 200'),reports:all('SELECT * FROM reports ORDER BY created DESC LIMIT 200'),orders:all('SELECT id,name,amount,status,created FROM orders ORDER BY created DESC LIMIT 200'),audit:all('SELECT * FROM audit_log ORDER BY created DESC LIMIT 100'),counts:{users:get('SELECT count(*) AS n FROM users').n,orders:get("SELECT count(*) AS n FROM orders WHERE status='paid'").n}});return true;
  }
  if(route==='/api/admin/moderate'&&method==='POST'){
   auth();if(!isAdmin(user))fail(403,'Administrator access required.');const target=clean(body.target,100),action=body.action;
   if(action==='suspend'||action==='restore-user'){if(target===user.id)fail(400,'You cannot suspend yourself.');if(!get('SELECT id FROM users WHERE id=?',target))fail(404,'Account not found');run('UPDATE users SET suspended=? WHERE id=?',action==='suspend'?1:0,target);if(action==='suspend')run('DELETE FROM sessions WHERE user_id=?',target);}
   else if(action==='hide'||action==='restore-content'){if(!get('SELECT id FROM records WHERE id=?',target))fail(404,'Content not found');run('UPDATE records SET hidden=? WHERE id=?',action==='hide'?1:0,target);}
   else if(action==='resolve-report'){if(!get('SELECT id FROM reports WHERE id=?',target))fail(404,'Report not found');run("UPDATE reports SET status='resolved' WHERE id=?",target);}
   else fail(400,'Unknown moderation action');audit(user,action,target);send(200,{ok:true});return true;
  }
  return false;
 }
 return {handle,isAdmin,ownedFile,download,uploadDir};
}

