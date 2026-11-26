const ROOT='https://4aces-racing.pages.dev', API='https://discord.com/api/v10', enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const un64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
const cookie=(n,v,age)=>`${n}=${v}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Lax`;
const getCookie=(r,n)=> (r.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(n+'='))?.slice(n.length+1);
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(v,status=200)=>Response.json(v,{status,headers});
function redirect(url,cookies=[]){const h=new Headers({...headers,Location:url});for(const c of cookies)h.append('Set-Cookie',c);return new Response(null,{status:303,headers:h});}
async function key(e){if(!e.SESSION_SECRET||e.SESSION_SECRET.length<32)throw Error('config');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode(e.SESSION_SECRET)),'AES-GCM',false,['encrypt','decrypt']);}
async function seal(e,v){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(e),enc.encode(JSON.stringify(v))));}
async function open(e,s){try{const [iv,data]=s.split('.');const v=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv)},await key(e),un64(data))));return v.exp>Date.now()?v:null;}catch{return null;}}
const roles=(s)=>String(s||'').split(',').map(x=>x.trim()).filter(x=>/^\d+$/.test(x));
async function discord(path,token){return fetch(API+path,{headers:{Authorization:'Bearer '+token}});}
// Cache only verified roles, keyed by the encrypted session's token hash.
const TTL=300000;
async function access(e,s){
 const digest=b64(await crypto.subtle.digest('SHA-256',enc.encode(s.token+'|'+e.DISCORD_GUILD_ID)));
 const cache=caches.default, k=new Request(ROOT+'/api/discord/__private_role_cache/'+digest);
 let saved; try{const hit=await cache.match(k);if(hit)saved=await hit.json();}catch{}
 if(saved?.until>Date.now()){
  if(saved.blocked)throw Object.assign(Error('Discord begrenzt Anfragen. Bitte in '+Math.ceil((saved.until-Date.now())/1000)+' Sekunden erneut versuchen.'),{status:429,stage:'discord'});
  return permissions(e,saved.roles);
 }
 const r=await discord('/users/@me/guilds/'+e.DISCORD_GUILD_ID+'/member',s.token);
 if(r.status===429){let body={};try{body=await r.json();}catch{} const seconds=Math.max(1,Number(r.headers.get('Retry-After'))||0,Number(body.retry_after)||0,Number(r.headers.get('X-RateLimit-Reset-After'))||0);const until=Date.now()+seconds*1000;try{await cache.put(k,Response.json({blocked:true,until},{headers:{'Cache-Control':'public, max-age='+Math.ceil(seconds)}}));}catch{} throw Object.assign(Error('Discord begrenzt Anfragen. Bitte in '+Math.ceil(seconds)+' Sekunden erneut versuchen.'),{status:429,stage:'discord'});}
 if(r.status===401)throw Object.assign(Error('Discord-Sitzung abgelaufen. Bitte erneut anmelden.'),{status:401,stage:'discord'});
 if(!r.ok&&r.status!==404)throw Object.assign(Error('Discord-Rollenprüfung fehlgeschlagen (HTTP '+r.status+').'),{status:503,stage:'discord'});
 const list=r.status===404?[]:(await r.json()).roles;if(!Array.isArray(list))throw Error('roles');
 const until=Math.min(Date.now()+TTL,s.exp);try{await cache.put(k,Response.json({roles:list,until},{headers:{'Cache-Control':'public, max-age='+Math.max(1,Math.floor((until-Date.now())/1000))}}));}catch{}
 return permissions(e,list);
}
function permissions(e,list){const admin=roles(e.DISCORD_ADMIN_ROLE_IDS).some(x=>list.includes(x));return {admin,member:admin||roles(e.DISCORD_MEMBER_ROLE_IDS).some(x=>list.includes(x))};}
function profile(s,a){return {name:s.name,avatar:s.avatar&&/^\d+$/.test(s.id)&&/^[a-zA-Z0-9_]+$/.test(s.avatar)?`https://cdn.discordapp.com/avatars/${s.id}/${s.avatar}.png?size=64`:null,...a};}
const tables={team_news:{fields:['title','content'],required:['title','content'],order:'id DESC'},race_calendar:{fields:['title','race_date','race_time','track','description'],required:['title','race_date'],order:'race_date ASC, race_time ASC'},race_results:{fields:['race_date','title','track','driver','position','points','description'],required:['race_date','title','driver'],order:'race_date DESC, id DESC'}};
export async function onRequest({request:r,env:e}){try{
 const u=new URL(r.url), p=u.pathname.replace(/^\/api\/discord\/?/,''), method=r.method;
 if(u.origin!==ROOT)return json({error:'Nur Produktionsdomain'},403);
 if(!['GET','POST','PUT','DELETE'].includes(method))return json({error:'Methode'},405);
 if(method!=='GET'&&r.headers.get('Origin')!==ROOT)return json({error:'Unzulässiger Ursprung'},403);
 if(p==='login'&&method==='GET'){const state=random();const q=new URLSearchParams({client_id:e.DISCORD_CLIENT_ID,response_type:'code',redirect_uri:ROOT+'/api/discord/callback',scope:'identify guilds.members.read',state});return redirect('https://discord.com/oauth2/authorize?'+q,[cookie('ar_state',await seal(e,{state,exp:Date.now()+600000}),600)]);}
 if(p==='callback'&&method==='GET'){const st=await open(e,getCookie(r,'ar_state')||'');if(!st||st.state!==u.searchParams.get('state')||!u.searchParams.get('code'))return redirect('/members/?error=login',[cookie('ar_state','',0)]);
 const t=await fetch(API+'/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:e.DISCORD_CLIENT_ID,client_secret:e.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code:u.searchParams.get('code'),redirect_uri:ROOT+'/api/discord/callback'})});if(!t.ok)throw Error('token');const token=await t.json();const user=await discord('/users/@me',token.access_token);if(!user.ok)throw Error('user');const d=await user.json();const age=Math.min(3600,Number(token.expires_in));if(!Number.isFinite(age)||age<=0)throw Error('expiry');const s={token:token.access_token,id:d.id,name:d.global_name||d.username,avatar:d.avatar,exp:Date.now()+age*1000};return redirect('/members/',[cookie('ar_state','',0),cookie('ar_session',await seal(e,s),age)]);}
 if(p==='logout'&&method==='POST')return redirect('/members/',[cookie('ar_session','',0)]);
 const s=await open(e,getCookie(r,'ar_session')||'');if(!s)return json({error:'Bitte anmelden'},401);
 const a=await access(e,s);
 if(p==='me'&&method==='GET')return json(profile(s,a));
 if(p==='dashboard'&&method==='GET'&&!a.member)return json({profile:profile(s,a),entries:{}});
 if(!a.member)return json({error:'Keine Mitgliederberechtigung'},403);
 if(!e.DB)throw Object.assign(Error('Datenbankbindung DB fehlt in der aktiven Bereitstellung.'),{stage:'database'});
 if(p==='dashboard'&&method==='GET'){const entries=await Promise.all(Object.entries(tables).map(async ([name,cfg])=>[name,(await e.DB.prepare(`SELECT * FROM ${name} ORDER BY ${cfg.order} LIMIT 500`).all()).results]));return json({profile:profile(s,a),entries:Object.fromEntries(entries)});}
 const signup=p.match(/^attendance\/(\d+)$/);
 if(signup){
  const race=signup[1];
  if(!['GET','PUT'].includes(method))return json({error:'Methode'},405);
  if(method==='PUT'){
   if(!r.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON erforderlich'},415);
   let data;try{const raw=await r.text();if(raw.length>1024)return json({error:'Zu lang'},413);data=JSON.parse(raw);}catch{return json({error:'Ungültige Eingabe'},400);}
   if(!['yes','maybe','no'].includes(data?.status))return json({error:'Ungültige Teilnahme'},400);
   const result=await e.DB.prepare(`INSERT INTO race_attendance (race_id,discord_id,display_name,avatar,status) SELECT id,?,?,?,? FROM race_calendar WHERE id=? ON CONFLICT(race_id,discord_id) DO UPDATE SET display_name=excluded.display_name,avatar=excluded.avatar,status=excluded.status`).bind(s.id,s.name,profile(s,a).avatar,data.status,race).run();
   if(!result.meta.changes)return json({error:'Rennen nicht gefunden'},404);
  }
  const rows=(await e.DB.prepare(`SELECT display_name,avatar,status,discord_id=? AS mine FROM race_attendance WHERE race_id=? ORDER BY display_name COLLATE NOCASE`).bind(s.id,race).all()).results;
  return json(rows);
 }
 const [table,id,extra]=p.split('/');if(!Object.hasOwn(tables,table)||extra||id&&!/^\d+$/.test(id))return json({error:'Nicht gefunden'},404);const cfg=tables[table];
 if(method==='GET'&&!id){const result=await e.DB.prepare(`SELECT * FROM ${table} ORDER BY ${cfg.order} LIMIT 500`).all();return json(result.results);}
 if(!a.admin)return json({error:'Keine Bearbeitungsberechtigung'},403);
 if(method==='DELETE'&&id){if(table==='race_calendar'){await e.DB.batch([e.DB.prepare('DELETE FROM race_attendance WHERE race_id=?').bind(id),e.DB.prepare('DELETE FROM race_calendar WHERE id=?').bind(id)]);}else await e.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();return json({ok:true});}
 if(!((method==='POST'&&!id)||(method==='PUT'&&id)))return json({error:'Methode'},405);
 if(!r.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON erforderlich'},415);
 const raw=await r.text();if(raw.length>40000)return json({error:'Zu lang'},413);let data;try{data=JSON.parse(raw);}catch{return json({error:'Ungültige Eingabe'},400);}
 if(!data||typeof data!=='object'||Array.isArray(data))return json({error:'Ungültige Eingabe'},400);
 const vals=[];for(const f of cfg.fields){let v=data[f];if(f==='position'||f==='points'){if(v==null||v==='')v=null;else {v=Number(v);if(!Number.isFinite(v)||(f==='position'&&(!Number.isInteger(v)||v<1)))return json({error:'Ungültige Zahl'},400);}}else{if(v!=null&&typeof v!=='string')return json({error:'Ungültiger Text'},400);v=(v||'').trim();if(v.length>10000||cfg.required.includes(f)&&!v)return json({error:'Pflichtfeld oder Länge prüfen'},400);if(f==='race_date'&&!/^\d{4}-\d{2}-\d{2}$/.test(v))return json({error:'Datum prüfen'},400);}vals.push(v);}
 const fields=[...cfg.fields];if(table==='team_news'&&method==='POST'){fields.push('author');vals.push(s.name);}
 if(method==='POST')await e.DB.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})`).bind(...vals).run();else await e.DB.prepare(`UPDATE ${table} SET ${fields.map(f=>f+'=?').join(',')} WHERE id=?`).bind(...vals,id).run();return json({ok:true});
 }catch(err){const stage=err.stage||(/D1|SQLITE|database|no such table/i.test(String(err.message))?'database':'server');console.error('4AR API failure',stage,err.name);return json({error:err.stage?err.message:stage==='database'?'Datenbankabfrage fehlgeschlagen. Bitte Cloudflare-D1 prüfen.':'Serverfehler bei der Verarbeitung.',stage},err.status||503);}}
