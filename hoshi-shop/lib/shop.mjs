import {demo,defaults} from '../public/catalog.js';
import ownerHash from './owner.mjs';
const enc=new TextEncoder();
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=async s=>hex(await crypto.subtle.digest('SHA-256',enc.encode(s)));
async function hash(p,s){const key=await crypto.subtle.importKey('raw',enc.encode(p),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',iterations:100000,hash:'SHA-256',salt:enc.encode(s)},key,256))}
function fail(code,status=400){throw Object.assign(Error(code),{status})}
function str(v,max=150,optional=false){if(typeof v!=='string'||v.length>max||(!optional&&!v.trim()))fail('invalid');return v.trim()}
function num(v,max=1e8){if(!Number.isSafeInteger(v)||v<0||v>max)fail('invalid');return v}
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const order=o=>({...JSON.parse(o.info),id:o.id,status:o.status,total:o.total,created:o.created});
const product=p=>({...JSON.parse(p.info),id:p.id,category:p.category,stock:p.stock,price:p.price,hidden:p.hidden,created:p.created,version:p.version});
async function seed(db){if(await db.prepare('SELECT id FROM settings WHERE id=1').first())return;
const insert=db.prepare('INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,0,?,1)');
await db.batch([...demo.map(({id,category,price,stock,created,...info})=>insert.bind(id,category,JSON.stringify(info),price,stock,created)),db.prepare('INSERT OR IGNORE INTO settings VALUES(1,?,?,?,?)').bind(defaults.name,defaults.phone,defaults.pickup,defaults.fee)])}
export async function handle(req,env,activation=ownerHash){try{
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\/shop\/?/,''),db=env.DB;
 const sql=(q,...args)=>db.prepare(q).bind(...args);
 if(path.startsWith('img/')&&req.method==='GET'){const file=await env.BUCKET.get(path.slice(4));if(!file)fail('missing',404);return new Response(file.body,{headers:{'Content-Type':file.httpMetadata.contentType,'X-Content-Type-Options':'nosniff','Cache-Control':'public,max-age=31536000,immutable'}})}
 await seed(db);
 const token=req.headers.get('Cookie')?.match(/(?:^|;\s*)hoshi_sid=([a-f0-9-]{36})/)?.[1];
 const sid=token?await digest(token):'',me=sid?await sql('SELECT u.id,u.name,u.login,u.role FROM users u JOIN sessions s ON s.uid=u.id WHERE s.id=? AND expires>?',sid,Date.now()).first():null;
 const seller=me?.role==='seller';
 if(req.method==='GET'){
 if(path==='state')return json({user:me,settings:await sql('SELECT name,pickup,phone,fee FROM settings WHERE id=1').first(),products:(await sql('SELECT * FROM products '+(seller?'':'WHERE hidden=0 ')+'ORDER BY created DESC').all()).results.map(product)});
 if(path==='orders'){if(!me)fail('login',401);const rows=await (seller?sql('SELECT * FROM orders ORDER BY created DESC'):sql('SELECT * FROM orders WHERE uid=? ORDER BY created DESC',me.id)).all();return json(rows.results.map(order))}fail('missing',404)
 }
 if(req.method!=='POST')fail('method',405);
 const origin=req.headers.get('Origin');if(origin&&origin!==url.origin)fail('forbidden',403);
 if(['settings','product','upload','status','restock'].includes(path)&&!seller)fail('forbidden',403);
 if(path==='upload'){
 const type=req.headers.get('Content-Type');if(!['image/jpeg','image/png','image/webp'].includes(type)||Number(req.headers.get('Content-Length'))>5e6)fail('photo');
 const bytes=await req.arrayBuffer();if(bytes.byteLength>5e6||bytes.byteLength<12)fail('photo');
 const head=new Uint8Array(bytes,0,12),matches=type==='image/png'?head[0]===137&&head[1]===80:type==='image/jpeg'?head[0]===255&&head[1]===216:String.fromCharCode(...head.slice(8))==='WEBP';if(!matches)fail('photo');
 const id=crypto.randomUUID();await env.BUCKET.put(id,bytes,{httpMetadata:{contentType:type}});return json({url:'/api/shop/img/'+id})}
 if(!req.headers.get('Content-Type')?.startsWith('application/json'))fail('invalid',415);
 const b=await req.json().catch(()=>fail('invalid'));if(!b||typeof b!=='object')fail('invalid');
 if(['login','register','activate'].includes(path)){
 const login=str(b.login,40).toLowerCase(),pw=b.password;if(!/^[\p{L}\p{N}_.-]{3,40}$/u.test(login)||typeof pw!=='string'||pw.length>128||!pw.length)fail('credentials');
 const now=Date.now(),k=await digest(login+'|'+(req.headers.get('cf-connecting-ip')||'local'));
 await sql('INSERT INTO limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END',k,now+900000,now,now).run();
 if((await sql('SELECT count FROM limits WHERE id=?',k).first()).count>20)fail('rate',429);
 let u=await sql('SELECT * FROM users WHERE login=?',login).first();
 if(path==='login'){if(!u||await hash(pw,u.salt)!==u.hash)fail('credentials',401)}
 else{if(pw.length<8)fail('password');if(path==='activate'&&(login!=='owner'||await digest(str(b.code,128))!==activation))fail('forbidden',403);
 if(u||path==='register'&&login==='owner')fail('taken',409);u={id:crypto.randomUUID(),login,name:str(b.name,80),role:path==='activate'?'seller':'buyer',salt:crypto.randomUUID()};
 try{await sql('INSERT INTO users VALUES(?,?,?,?,?,?)',u.id,login,u.name,u.salt,await hash(pw,u.salt),u.role).run()}catch{fail('taken',409)}}
 const raw=crypto.randomUUID();await db.batch([sql('DELETE FROM limits WHERE id=?',k),sql('INSERT INTO sessions VALUES(?,?,?)',await digest(raw),u.id,now+2592000000)]);
 return json({role:u.role},200,{'Set-Cookie':'hoshi_sid='+raw+'; Path=/; Max-Age=2592000; SameSite=Lax; HttpOnly'+(url.protocol==='https:'?'; Secure':'')})
 }
 if(path==='logout'){await sql('DELETE FROM sessions WHERE id=?',sid).run();return json({},200,{'Set-Cookie':'hoshi_sid=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly'})}
 if(path==='settings'){const phone=str(b.phone,30,true);if(phone&&!/^\+998\d{9}$/.test(phone))fail('phone');await sql('UPDATE settings SET name=?,pickup=?,phone=?,fee=? WHERE id=1',str(b.name,80),str(b.pickup,300,true),phone,num(b.fee)).run();return json({})}
 if(path==='product'){if(!['notebooks','keychains','stickers'].includes(b.category))fail('invalid');if(!Array.isArray(b.images)||!b.images.length||b.images.length>6||b.images.some(x=>typeof x!=='string'||!/^\/(art\/item[0-8]\.webp|api\/shop\/img\/[a-f0-9-]{36})$/.test(x)))fail('photo');
 const info={name:str(b.name),anime:str(b.anime),desc:str(b.desc,2400),spec:str(b.spec,1000),images:b.images};
 for(const [key,max] of [['ru',150],['descRu',2400],['specRu',1000]])if(b[key])info[key]=str(b[key],max);
 const args=[b.category,JSON.stringify(info),num(b.price),num(b.stock,1e6),b.hidden?1:0],id=b.id?str(b.id,80):crypto.randomUUID();
 if(b.id){const r=await sql('UPDATE products SET category=?,info=?,price=?,stock=?,hidden=?,version=version+1 WHERE id=? AND version=?',...args,id,num(b.version)).run();if(!r.meta.changes)fail('changed',409)}
 else await sql('INSERT INTO products(category,info,price,stock,hidden,id,created,version) VALUES(?,?,?,?,?,?,?,1)',...args,id,Date.now()).run();return json({id})}
 if(path==='restock'){const id=str(b.id,80),qty=num(b.qty,1e6);if(!qty)fail('invalid');const r=await sql('UPDATE products SET stock=stock+?,version=version+1 WHERE id=? AND stock+?<=1000000',qty,id,qty).run();if(!r.meta.changes)fail('invalid');return json({})}
 if(path==='checkout'){if(!me)fail('login',401);const nonce=str(b.nonce,90);
 const existing=()=>sql('SELECT * FROM orders WHERE uid=? AND nonce=?',me.id,nonce).first();const previous=await existing();if(previous)return json(order(previous));
 const name=str(b.name,80),phone=str(b.phone,20),method=b.method;if(!/^\+998\d{9}$/.test(phone))fail('phone');if(!['delivery','pickup'].includes(method))fail('invalid');
 const cfg=await sql('SELECT * FROM settings WHERE id=1').first(),fee=method==='pickup'?0:cfg.fee,address=method==='pickup'?cfg.pickup:str(b.address,300);
 if(!address)fail('pickup');if(b.fee!==fee||method==='pickup'&&b.address!==address)fail('changed',409);
 if(!Array.isArray(b.items)||!b.items.length||b.items.length>80||new Set(b.items.map(i=>i.id)).size!==b.items.length)fail('invalid');
 const items=[],batch=[];let total=fee;
 for(const i of b.items){const p=await sql('SELECT * FROM products WHERE id=?',str(i.id,80)).first(),qty=num(i.qty,1e6);
 if(!qty||!p||p.hidden||p.stock<qty||i.price!==p.price)fail('changed',409);const data=product(p);items.push({id:p.id,name:data.name,ru:data.ru||'',image:data.images[0],price:p.price,qty});total+=p.price*qty;
 batch.push(sql('UPDATE products SET stock=CASE WHEN hidden=0 AND price=? AND stock>=? AND EXISTS(SELECT 1 FROM settings WHERE id=1 AND (CASE WHEN ?=\'pickup\' THEN pickup=? ELSE fee=? END)) THEN stock-? ELSE -1 END,version=version+1 WHERE id=?',p.price,qty,method,address,fee,qty,p.id))}
 const id='HS-'+crypto.randomUUID().slice(0,8).toUpperCase(),created=Date.now(),info={items,name,phone,method,address,fee};
 batch.unshift(sql('INSERT INTO orders VALUES(?,?,?,?,?,?,?)',id,me.id,nonce,JSON.stringify(info),total,'new',created));
 try{await db.batch(batch)}catch{const retry=await existing();if(retry)return json(order(retry));fail('changed',409)}return json({...info,id,created,total,status:'new'})}
 if(path==='status'){const id=str(b.id,80),status=b.status;if(!['new','accepted','ready','shipped','completed','cancelled'].includes(status))fail('invalid');
 const o=await sql('SELECT * FROM orders WHERE id=?',id).first();if(!o)fail('missing',404);if(o.status===status)return json({});if(o.status==='cancelled')fail('changed',409);
 const batch=[];if(status==='cancelled')for(const i of JSON.parse(o.info).items)batch.push(sql("UPDATE products SET stock=stock+?,version=version+1 WHERE id=? AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status!='cancelled')",i.qty,i.id,id));
 batch.push(sql("UPDATE orders SET status=? WHERE id=? AND status!='cancelled'",status,id));await db.batch(batch);return json({})}
 if(path==='delete'){if(!seller)fail('forbidden',403);await sql('DELETE FROM products WHERE id=?',str(b.id,80)).run();return json({})}
 fail('missing',404)
 }catch(e){if(!e.status)console.error('shop',e.message);return json({error:e.status?e.message:'server'},e.status||500)}}
