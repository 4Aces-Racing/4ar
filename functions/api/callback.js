const origin='https://4aces-racing.pages.dev';
export async function onRequestGet({request,env}) {
 const url=new URL(request.url); const state=url.searchParams.get('state');
 const cookie=(request.headers.get('Cookie')||'').match(/(?:^|;\s*)__Host-oauth_state=([^;]+)/)?.[1];
 const fail=()=>new Response('Anmeldung fehlgeschlagen. Bitte Admin erneut öffnen.',{status:403,headers:{'Cache-Control':'no-store','Set-Cookie':'__Host-oauth_state=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'}});
 if(url.origin!==origin || !state || state!==cookie || !url.searchParams.get('code') || !env.GITHUB_CLIENT_SECRET) return fail();
 try {
 const response=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),redirect_uri:origin+'/api/callback'})});
 const data=await response.json(); if(!response.ok||!data.access_token)return fail();
 const user=await fetch('https://api.github.com/user',{headers:{Authorization:'Bearer '+data.access_token,'User-Agent':'4Aces-Racing-Admin',Accept:'application/vnd.github+json'}});
 if(!user.ok || (await user.json()).login?.toLowerCase()!=='4aces-racing')return fail();
 const message='authorization:github:success:'+JSON.stringify({token:data.access_token,provider:'github'});
 const nonce=crypto.randomUUID();
 return new Response(`<!doctype html><html lang="de"><meta charset="utf-8"><title>Anmeldung</title><p>Anmeldung abgeschlossen. Dieses Fenster schließt sich automatisch.</p><script nonce="${nonce}">const origin=${JSON.stringify(origin)};window.addEventListener('message',e=>{if(e.origin===origin && e.source===window.opener){window.opener.postMessage(${JSON.stringify(message).replace(/</g,'\\u003c')},origin);window.close();}});if(window.opener)window.opener.postMessage('authorizing:github',origin);</script></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`,'Set-Cookie':'__Host-oauth_state=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'}});
 }catch{return fail();}
}