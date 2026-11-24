export async function onRequestGet({request,env}) {
 const origin = 'https://4aces-racing.pages.dev';
 if(new URL(request.url).origin !== origin || !env.GITHUB_CLIENT_ID) return new Response('Konfiguration fehlt', {status:400});
 const state = crypto.randomUUID();
 const url = new URL('https://github.com/login/oauth/authorize');
 url.search = new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:origin+'/api/callback',scope:'public_repo',state}).toString();
 return new Response(null,{status:302,headers:{Location:url.href,'Set-Cookie':`__Host-oauth_state=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600`,'Cache-Control':'no-store'}});
}