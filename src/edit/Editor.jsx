/* The editor page (/edit). Sign in with GitHub, edit the page as visitors see it, Publish.

   Full editing: sections can be added from the library, moved, duplicated and deleted, and
   every word, link and photo inside them is a field. That is safe here because the editor
   and the public page share one definition (src/site/config.jsx) and one file
   (src/content/page.json): Publish writes exactly what the editor holds, with no mapping
   in between that a new or moved section could break.

   Publish = one commit on the live branch (page.json + any new photos) -> Netlify rebuilds
   -> live in about two minutes. Unpublished work is kept in this browser (localStorage), so
   closing the tab loses nothing. Git is the version history: any publish can be undone. */

import { useEffect, useMemo, useState } from 'react';
import { Puck } from '@measured/puck';
import { makeConfig } from '../site/config';
import { ImgSrc } from '../site/kit';
import { getToken, setToken, signIn, whoAmI, loadContent, commitFiles, contentFile } from './github';
import { photoField, photoSrc, pendingFiles, referencedPhotos, clearPending } from './photo-field';
import { loadPageCss, scopeCss } from './scope-css';
import pageCssUrl from '../index.css?url';
import { REPO } from './repo';
import bundled from '../content/page.json';

const DRAFT_KEY = 'dtm-editor-draft';

function loadDraft() {
  try { const raw = localStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveDraft(data) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, savedAt: new Date().toISOString() })); } catch { /* losing the safety copy never loses the edit */ }
}
function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* same */ }
}

export function Editor() {
  const config = useMemo(() => makeConfig(photoField), []);
  const [stage, setStage] = useState(getToken() ? { kind: 'loading' } : { kind: 'signin' });
  const [publish, setPublish] = useState({ state: 'idle', text: '' });

  // Dev only: ?local=1 opens the editor on the bundled page.json with no sign-in, so the
  // canvas and fields can be checked without GitHub. Publish is refused in this mode.
  const local = import.meta.env.DEV && new URLSearchParams(window.location.search).get('local') === '1';

  useEffect(() => {
    if (stage.kind !== 'loading' && !(local && stage.kind === 'signin')) return;
    const token = getToken();
    if (!token && !local) { setStage({ kind: 'signin' }); return; }
    (async () => {
      try {
        const [user, live, css] = local
          ? await Promise.all(['local preview', { content: bundled }, loadPageCss(pageCssUrl)])
          : await Promise.all([whoAmI(token), loadContent(token), loadPageCss(pageCssUrl)]);
        const draft = loadDraft();
        setStage({ kind: 'ready', user, css: scopeCss(css), data: draft?.data ?? live.content, draftFrom: draft?.savedAt });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (!getToken()) setStage({ kind: 'signin', error: message });
        else setStage({ kind: 'error', message });
      }
    })();
  }, [stage.kind, local]);

  const onSignIn = async () => {
    setStage({ kind: 'signin', busy: true });
    try {
      setToken(await signIn());
      setStage({ kind: 'loading' });
    } catch (e) {
      setStage({ kind: 'signin', error: e instanceof Error ? e.message : String(e) });
    }
  };

  const onPublish = async (data) => {
    if (local) return setPublish({ state: 'error', text: 'Local preview: nothing is published from here.' });
    const token = getToken();
    if (!token) return setStage({ kind: 'signin', error: 'Your sign-in expired. Sign in again to publish.' });
    setPublish({ state: 'busy', text: 'Publishing…' });
    try {
      const photos = pendingFiles(referencedPhotos(data));
      const files = [contentFile(data), ...photos];
      const what = photos.length ? `page and ${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'page';
      const sha = await commitFiles(token, files, `Website update: ${what} (via the editor)`);
      clearPending();
      clearDraft();
      setPublish({ state: 'done', text: `Published (${sha.slice(0, 7)}). The live site catches up in about two minutes.` });
    } catch (e) {
      setPublish({ state: 'error', text: `Not published: ${e instanceof Error ? e.message : String(e)}. Your changes are still here; try again.` });
    }
  };

  // Dev only: paste a token instead of running the OAuth proxy, which needs Netlify.
  const devToken = import.meta.env.DEV;

  if (stage.kind === 'signin') {
    return (
      <Shell>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Edit the website</h1>
        <p style={{ margin: '0 0 20px', color: '#555' }}>Sign in with your GitHub account. Your changes go live about two minutes after you publish.</p>
        <button type="button" onClick={onSignIn} disabled={stage.busy} style={primary}>{stage.busy ? 'Opening GitHub…' : 'Sign in with GitHub'}</button>
        {stage.error && <p role="alert" style={{ color: '#92161D', marginTop: 16 }}>{stage.error}</p>}
        {devToken && (
          <form onSubmit={(e) => { e.preventDefault(); const t = new FormData(e.currentTarget).get('t'); if (typeof t === 'string' && t) { setToken(t.trim()); setStage({ kind: 'loading' }); } }} style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid #ddd' }}>
            <p style={{ fontSize: 12, color: '#777', margin: '0 0 6px' }}>Local development only: paste a GitHub token (`gh auth token`).</p>
            <input name="t" type="password" placeholder="ghp_… / gho_…" style={{ font: 'inherit', padding: 6, width: 280, marginRight: 8 }} />
            <button type="submit" style={{ ...primary, padding: '6px 12px' }}>Use token</button>
          </form>
        )}
      </Shell>
    );
  }
  if (stage.kind === 'loading') return <Shell><p>Loading the live site…</p></Shell>;
  if (stage.kind === 'error') {
    return (
      <Shell>
        <p role="alert" style={{ color: '#92161D' }}>{stage.message}</p>
        <p style={{ fontSize: 13, color: '#666' }}>Reading from <code>{REPO}</code>.</p>
        <button type="button" onClick={() => { setToken(null); setStage({ kind: 'signin' }); }} style={primary}>Sign in again</button>
      </Shell>
    );
  }

  return (
    <div className="editor-shell">
      <style>{stage.css}</style>
      {stage.draftFrom && (
        <Banner>
          Picked up where you left off (unpublished changes from {new Date(stage.draftFrom).toLocaleString()}).{' '}
          <button type="button" onClick={() => { clearDraft(); clearPending(); setStage({ kind: 'loading' }); }} style={link}>Discard them and load the live site instead</button>
        </Banner>
      )}
      {publish.state !== 'idle' && (
        <Banner tone={publish.state === 'error' ? 'error' : publish.state === 'done' ? 'ok' : 'info'}>
          {publish.text}
          {publish.state !== 'busy' && <button type="button" onClick={() => setPublish({ state: 'idle', text: '' })} style={link}>Dismiss</button>}
        </Banner>
      )}
      <ImgSrc.Provider value={photoSrc}>
        <Puck
          config={config}
          data={stage.data}
          headerTitle="DaTruthMeter"
          headerPath={`signed in as ${stage.user}`}
          onChange={saveDraft}
          onPublish={onPublish}
          iframe={{ waitForStyles: true }}
        />
      </ImgSrc.Provider>
    </div>
  );
}

function Shell({ children }) {
  return (
    <main style={{ maxWidth: 520, margin: '10vh auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', lineHeight: 1.5 }}>
      {children}
    </main>
  );
}

function Banner({ children, tone = 'info' }) {
  const bg = { info: '#eef1f5', ok: '#e6f4ea', error: '#fbeae5' }[tone];
  return (
    <div role="status" style={{ background: bg, borderBottom: '1px solid rgba(0,0,0,.08)', padding: '8px 16px', fontSize: 13, fontFamily: 'system-ui, sans-serif', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {children}
    </div>
  );
}

const primary = { font: 'inherit', fontSize: 15, padding: '10px 18px', borderRadius: 8, border: 0, background: '#101116', color: '#F5F0E9', cursor: 'pointer' };
const link = { font: 'inherit', fontSize: 13, background: 'none', border: 0, padding: 0, color: '#1E3B57', textDecoration: 'underline', cursor: 'pointer' };
