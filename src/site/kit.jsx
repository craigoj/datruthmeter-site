import { createContext, Fragment, useContext, useEffect, useState } from 'react';

/* Shared pieces every section uses. Nothing here knows about the editor: the public page
   and the /edit canvas render the same components (src/site/config.jsx). */

/* ---------- page context: what any section can reach ---------- */

export const Page = createContext({
  play: () => {},
  contactEmail: '',
  sendfoxUrl: '',
  editing: false,
});
export const usePage = () => useContext(Page);

/* Resolves an image path to something an <img> can show. Identity on the public page; the
   editor provides one that shows photos picked but not yet published (src/edit/photo-field.jsx). */
export const ImgSrc = createContext((p) => p);

/* ---------- text conventions Tim types in the editor ----------
   *word*   red
   ~word~   outlined
   a new line in a heading is a line break */
export function Accent({ text = '', outline = 'outline-text' }) {
  const lines = String(text).split('\n');
  return lines.map((line, li) => (
    <Fragment key={li}>
      {li > 0 && <br />}
      {line.split(/(\*[^*]+\*|~[^~]+~)/g).map((part, i) => {
        if (/^\*[^*]+\*$/.test(part)) return <span key={i} className="text-red">{part.slice(1, -1)}</span>;
        if (/^~[^~]+~$/.test(part)) return <span key={i} className={outline}>{part.slice(1, -1)}</span>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  ));
}

export const BANDS = {
  ink: 'band-ink',
  paper: 'band-paper',
  navy: 'band-navy',
  red: 'band-red',
};

export const ytThumb = (id, own) => own || (id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '');

export function Img({ src, ...rest }) {
  const resolve = useContext(ImgSrc);
  if (!src) return null;
  return <img src={resolve(src)} {...rest} />;
}

/* ---------- the mark ---------- */

export function Thermo({ className = '', fill = 1 }) {
  // Drawn from his logo: a thermometer with a flame behind the bulb.
  const h = 150 * fill;
  return (
    <svg viewBox="0 0 60 220" className={className} aria-hidden>
      <path d="M30 150c-22 8-30 30-22 48 6 13 20 20 30 18-8-6-12-14-9-24 3 6 8 9 13 9-4-8-2-17 4-24 4 10 12 14 12 26 6-12 4-28-8-40-6-6-14-9-20-13z" fill="var(--color-blood)" />
      <rect x="22" y="8" width="16" height="170" rx="8" fill="none" stroke="var(--color-paper)" strokeWidth="3" />
      <rect x="26.5" y={172 - h} width="7" height={h} rx="3.5" fill="var(--color-red)" />
      <circle cx="30" cy="186" r="15" fill="var(--color-red)" stroke="var(--color-paper)" strokeWidth="3" />
    </svg>
  );
}

/* ---------- the scroll gauge ----------
   Stops are read from the page itself: any section with a "gauge word" renders
   data-gauge, so adding, removing or moving sections in the editor moves the stops. */

export function useScroll(rootRef) {
  const [state, setState] = useState({ p: 0, stops: [], active: 0 });
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const doc = el.ownerDocument;
    const win = doc.defaultView;
    const on = () => {
      const max = doc.documentElement.scrollHeight - win.innerHeight;
      const p = max > 0 ? Math.min(1, win.scrollY / max) : 0;
      const stops = [...el.querySelectorAll('[data-gauge]')].map((s) => ({ id: s.id, word: s.dataset.gauge }));
      let active = 0;
      stops.forEach((s, i) => {
        const node = s.id && doc.getElementById(s.id);
        if (node && node.getBoundingClientRect().top < win.innerHeight * 0.5) active = i;
      });
      setState((prev) => (prev.p === p && prev.active === active && prev.stops.length === stops.length && prev.stops.every((s, i) => s.word === stops[i].word && s.id === stops[i].id) ? prev : { p, stops, active }));
    };
    on();
    win.addEventListener('scroll', on, { passive: true });
    win.addEventListener('resize', on);
    const mo = new win.MutationObserver(on);
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-gauge', 'id'] });
    return () => { win.removeEventListener('scroll', on); win.removeEventListener('resize', on); mo.disconnect(); };
  }, [rootRef]);
  return state;
}

export function MeterRail({ p, stops, active }) {
  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-paper/10 lg:hidden">
        <div className="h-full bg-red" style={{ width: `${p * 100}%` }} />
      </div>
      <nav className="fixed left-0 top-0 z-40 hidden h-screen w-20 flex-col items-center justify-between border-r border-paper/10 bg-ink/80 py-6 backdrop-blur lg:flex" aria-label="Sections">
        <a href="#top" className="display text-sm tracking-widest [writing-mode:vertical-rl] rotate-180">DaTruth<span className="text-red">Meter</span></a>
        <div className="relative flex h-[46vh] w-full justify-center">
          <div className="relative h-full w-3 rounded-full border-2 border-paper/70">
            <div className="absolute bottom-0 left-0 right-0 rounded-full bg-red" style={{ height: `${Math.max(p, 0.03) * 100}%` }} />
          </div>
          <div className="absolute -bottom-6 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border-2 border-paper/70 bg-red" />
          {stops.map((s, i) => (
            <a key={`${s.id}-${i}`} href={`#${s.id}`} aria-label={s.word} className="group absolute left-[calc(50%+14px)] flex items-center" style={{ bottom: `${(stops.length > 1 ? i / (stops.length - 1) : 0) * 92 + 2}%` }}>
              <span className={`h-px w-3 ${active >= i ? 'bg-red' : 'bg-paper/40'}`} />
            </a>
          ))}
        </div>
        <div className="mono text-center text-[9px] leading-tight text-paper/60">
          <span className="display block text-2xl text-paper tabular-nums">{Math.round(p * 100)}°</span>
          {stops[active]?.word}
        </div>
      </nav>
    </>
  );
}

/* ---------- video player ---------- */

export function Player({ id, onClose }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!id) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-night/95 p-4 text-cream" onClick={onClose} role="dialog" aria-modal>
      <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex justify-between">
          <span className="mono text-xs text-red">Now playing</span>
          <button onClick={onClose} className="mono text-xs hover:text-red">Close</button>
        </div>
        <div className="aspect-video w-full bg-night">
          <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title="DaTruthMeter video" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      </div>
    </div>
  );
}

/* ---------- light / dark ---------- */

const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* private mode: fine */ } },
};
export { store };

export function useTheme(rootRef) {
  const [pref, setPref] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('theme');
    if (q === 'light' || q === 'dark') return q;
    const s = store.get('dtm-theme');
    return s === 'light' || s === 'dark' ? s : 'system';
  });
  const mq = () => window.matchMedia('(prefers-color-scheme: light)');
  const [sys, setSys] = useState(() => (mq().matches ? 'light' : 'dark'));

  useEffect(() => {
    const m = mq();
    const on = (e) => setSys(e.matches ? 'light' : 'dark');
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);

  const theme = pref === 'system' ? sys : pref;

  useEffect(() => {
    const html = rootRef.current?.ownerDocument.documentElement;
    if (!html) return undefined;
    html.classList.toggle('hub-light', theme === 'light');
    return () => html.classList.remove('hub-light');
  }, [theme, rootRef]);

  const choose = (t) => { setPref(t); store.set('dtm-theme', t); };
  return [theme, choose];
}

export function ThemeSwitch({ theme, onChoose, className = '' }) {
  return (
    <div className={`mono flex border border-paper/25 text-[10px] ${className}`} role="group" aria-label="Color theme">
      {['light', 'dark'].map((t) => (
        <button key={t} onClick={() => onChoose(t)} aria-pressed={theme === t}
          className={`px-2.5 py-1.5 ${theme === t ? 'bg-paper text-ink' : 'hover:text-red'}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

/* ---------- marquee ---------- */

export function MarqueeRow({ words }) {
  const list = words.length ? words : ['Let’s tell da truth'];
  const row = [...list, ...list, ...list];
  return (
    <div className="overflow-hidden border-y border-paper/15 bg-red py-3 text-cream">
      <div className="marquee">
        {[0, 1].map((k) => (
          <div key={k} className="flex shrink-0 items-center">
            {row.map((w, i) => (
              <span key={i} className="display flex items-center gap-6 px-6 text-3xl sm:text-4xl">
                {w}<Thermo className="h-8 w-3" fill={0.7} />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- The Syllabus signup ----------
   One form for the section and the pop-up. With a SendFox form URL set (Site settings in
   the editor) it posts straight to SendFox (their embed form fields: first_name, email). */

export const POPUP_KEY = 'dtm-syllabus-popup';

export function SyllabusForm({ compact = false, button = 'Get The Syllabus', onDone }) {
  const { sendfoxUrl } = usePage();
  const [sent, setSent] = useState(false);
  const live = Boolean(sendfoxUrl);
  if (sent) {
    return (
      <p className="display text-3xl text-red" role="status">
        {live ? 'You are on the list.' : 'Preview only. Once SendFox is connected, this adds you to The Syllabus.'}
      </p>
    );
  }
  return (
    <form
      action={live ? sendfoxUrl : undefined}
      method={live ? 'post' : undefined}
      target={live ? '_blank' : undefined}
      onSubmit={(e) => { if (!live) e.preventDefault(); setSent(true); onDone?.(); }}
      className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-[1fr_1.3fr_auto]'}`}
    >
      <label className="block">
        <span className="sr-only">First name</span>
        <input name="first_name" autoComplete="given-name" placeholder="First name"
          className="w-full border border-paper/25 bg-transparent px-4 py-3 font-[family-name:var(--font-mono)] text-sm outline-none placeholder:text-paper/45 focus:border-red" />
      </label>
      <label className="block">
        <span className="sr-only">Email</span>
        <input name="email" type="email" required autoComplete="email" placeholder="you@school.org"
          className="w-full border border-paper/25 bg-transparent px-4 py-3 font-[family-name:var(--font-mono)] text-sm outline-none placeholder:text-paper/45 focus:border-red" />
      </label>
      <button className="display bg-red px-7 py-3 text-xl text-cream hover:bg-blood">{button}</button>
    </form>
  );
}

export function SyllabusPopup({ show, onClose, kicker, title, body }) {
  useEffect(() => {
    if (!show) return undefined;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [show, onClose]);
  if (!show) return null;
  return (
    <div className="pop-in fixed bottom-4 right-3 z-[75] w-[calc(100%-1.5rem)] max-w-sm border border-paper/25 bg-ink p-6 shadow-2xl sm:right-6" role="dialog" aria-label={title}>
      <div className="flex items-start justify-between gap-4">
        <p className="mono text-[10px] text-red">{kicker}</p>
        <button onClick={onClose} className="mono text-[10px] hover:text-red" aria-label="Close">Close</button>
      </div>
      <p className="display mt-2 text-4xl">{title}</p>
      <p className="mt-2 text-paper/75">{body}</p>
      <div className="mt-5"><SyllabusForm compact onDone={() => store.set(POPUP_KEY, 'subscribed')} /></div>
    </div>
  );
}

/* ---------- inquiry form (opens the visitor's email) ---------- */

export function InquiryForm({ heading, options }) {
  const { contactEmail } = usePage();
  const kinds = options.length ? options : ['General'];
  const [kind, setKind] = useState(kinds[0]);
  const send = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = `${f.get('message') || ''}\n\n${f.get('name') || ''}\n${f.get('org') || ''}`;
    window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(`${kind}: ${f.get('org') || f.get('name') || 'Inquiry'}`)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <form onSubmit={send} className="border border-paper/25 p-6 sm:p-8">
      <p className="mono text-[10px] text-red">Inquire</p>
      <p className="display mt-2 text-4xl">{heading}</p>
      <div className="mono mt-6 flex flex-wrap gap-2 text-[10px]" role="radiogroup" aria-label="What is this about">
        {kinds.map((k) => (
          <button type="button" key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
            className={`border px-3 py-2 ${kind === k ? 'border-red bg-red text-cream' : 'border-paper/25 hover:border-paper'}`}>{k}</button>
        ))}
      </div>
      {[['name', 'Your name', 'name'], ['org', 'School, district or organization', 'organization']].map(([n, l, ac]) => (
        <label key={n} className="mt-5 block">
          <span className="mono text-[10px] text-paper/60">{l}</span>
          <input name={n} autoComplete={ac} className="mt-1 w-full border-b border-paper/40 bg-transparent py-2 text-lg outline-none focus:border-red" />
        </label>
      ))}
      <label className="mt-5 block">
        <span className="mono text-[10px] text-paper/60">What you have in mind</span>
        <textarea name="message" rows={3} className="mt-1 w-full resize-none border-b border-paper/40 bg-transparent py-2 text-lg outline-none focus:border-red" />
      </label>
      <button className="display mt-7 w-full bg-paper px-6 py-4 text-xl text-ink hover:bg-red hover:text-cream">Send</button>
      <p className="mono mt-3 text-[9px] text-paper/50">Opens your email, addressed to {contactEmail}</p>
    </form>
  );
}
