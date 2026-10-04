/*
  Netlify Function — GitHub OAuth proxy for the site editor at /edit (src/edit/github.ts).

  The editor opens a popup pointing at ${base_url}/${auth_endpoint}?provider=github
  (see src/edit/github.ts signIn). This function:
   1. Redirects the user to GitHub for authorization
   2. Handles the callback and swaps the code for an access token
   3. Posts the token back to the opener window so the CMS can commit on the
      user's behalf

  The token is never stored server-side. It lives only in the browser session.

  ── Setup, one time, both are dashboard-only steps ──────────────────────────────

  1. GitHub OAuth App — https://github.com/settings/developers → New OAuth App
       Application name:            DaTruthMeter website editor
       Homepage URL:                https://datruthmeter-site.netlify.app
       Authorization callback URL:  https://datruthmeter-site.netlify.app/.netlify/functions/auth/callback

     Created first under CTRL Tech's GitHub against the Netlify preview URL. At
     handoff it is recreated under Tim's own GitHub account, with both URLs on
     datruthmeter.com. GitHub allows editing the URLs after creation.

  2. Netlify env vars — Site settings → Environment variables
       OAUTH_CLIENT_ID      the OAuth app's Client ID
       OAUTH_CLIENT_SECRET  the OAuth app's Client secret

     Netlify env vars do NOT travel with a site transfer. After the site moves to
     the owner's Netlify account, confirm both are still set, and re-enter them
     if not, or the editor will load and then fail at sign in.
*/

const CLIENT_ID = process.env.OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.OAUTH_CLIENT_SECRET;

const STATUS = {
  success: 'success',
  error: 'error',
};

function renderClosePage(status, content) {
  // postMessage protocol the editor expects (same one Decap/Sveltia use):
  //   "authorization:github:success:{json}"
  //   "authorization:github:error:{json}"
  const message = `authorization:github:${status}:${JSON.stringify(content)}`;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Authorizing…</title>
  </head>
  <body>
    <p>Authorizing with GitHub… this window will close automatically.</p>
    <script>
      (function () {
        var allowedOrigin = window.location.origin;
        function send() {
          if (window.opener) {
            window.opener.postMessage(${JSON.stringify(message)}, allowedOrigin);
          }
        }
        // The CMS posts "authorizing:github" back at us, then expects the auth message.
        window.addEventListener('message', function (event) {
          if (event.data === 'authorizing:github') {
            send();
          }
        }, false);
        send();
        setTimeout(function () { window.close(); }, 1200);
      })();
    </script>
  </body>
</html>`;
}

export const handler = async (event) => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return {
      statusCode: 500,
      body: 'OAuth not configured: OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET env vars missing in Netlify.',
    };
  }

  const url = new URL(event.rawUrl);
  // Strip the function prefix so we can route on the trailing path.
  const subpath = url.pathname
    .replace(/^\/\.netlify\/functions\/auth/, '')
    .replace(/^\/api\/auth/, '');

  // Step 1: kick off the OAuth dance.
  if (subpath === '' || subpath === '/') {
    const scope = url.searchParams.get('scope') || 'repo,user';
    const callback = `${url.origin}/.netlify/functions/auth/callback`;
    const ghUrl = new URL('https://github.com/login/oauth/authorize');
    ghUrl.searchParams.set('client_id', CLIENT_ID);
    ghUrl.searchParams.set('redirect_uri', callback);
    ghUrl.searchParams.set('scope', scope);
    return {
      statusCode: 302,
      headers: { Location: ghUrl.toString() },
    };
  }

  // Step 2: GitHub redirected back with ?code=… — swap it for a token.
  if (subpath === '/callback') {
    const code = url.searchParams.get('code');
    if (!code) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: renderClosePage(STATUS.error, { error: 'missing_code' }),
      };
    }

    let tokenJson = null;
    try {
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
        }),
      });
      tokenJson = await tokenRes.json();
    } catch (err) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: renderClosePage(STATUS.error, { error: 'token_fetch_failed', detail: String(err) }),
      };
    }

    if (!tokenJson || !tokenJson.access_token) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: renderClosePage(STATUS.error, {
          error: tokenJson?.error || 'no_access_token',
          detail: tokenJson?.error_description || null,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: renderClosePage(STATUS.success, {
        token: tokenJson.access_token,
        provider: 'github',
      }),
    };
  }

  return { statusCode: 404, body: 'Not found' };
};
