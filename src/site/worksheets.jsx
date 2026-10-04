import { useState } from 'react';

/* The Truth Resource Guides' printable worksheets. Three kinds, each its own section that
   lives inside a guides band: fill in the blanks, a docket, and true or false. Every word,
   answer and source is a field in the editor. Figures in the starting set are quoted from
   Tim's two essays on datruthmeter.com, which cite the sources named on each sheet. */

/* Width on a large screen. On a phone every sheet is full width. */
export const SHEET_WIDTH = {
  wide: 'lg:col-span-12',
  left: 'lg:col-span-7',
  right: 'lg:col-span-5',
};

function Sheet({ kicker, title, titleItalic, objective, width, dragRef, children }) {
  return (
    <article ref={dragRef} className={`rec-sheet rec-root ${SHEET_WIDTH[width] || SHEET_WIDTH.wide}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b-2 border-ink pb-3">
        <p className="rec-mono text-[11px] text-blood">{kicker}</p>
        <p className="rec-mono text-[11px] text-ink/70">Name <span className="rec-line w-28 sm:w-40" /> Period <span className="rec-line w-10" /></p>
      </header>
      <h3 className="rec-display mt-5 text-[2rem] leading-[1.02] sm:text-[2.6rem]">
        {title}{titleItalic && <> <em className="rec-ital">{titleItalic}</em></>}
      </h3>
      {objective && <p className="mt-3 text-[15px] leading-relaxed"><span className="rec-mono mr-2 text-[10px] text-blood">Objective</span>{objective}</p>}
      {children}
    </article>
  );
}

function Source({ text, link }) {
  if (!text && !link) return null;
  return (
    <p className="rec-mono mt-6 border-t border-ink/20 pt-3 text-[10px] leading-relaxed text-ink/60">
      {text && <>Source: {text}</>}
      {link && <> · <a href={link} target="_blank" rel="noreferrer" className="text-blood underline underline-offset-4">read the essay</a></>}
    </p>
  );
}

function Discuss({ items }) {
  const qs = (items || []).map((x) => x.question).filter(Boolean);
  if (!qs.length) return null;
  return (
    <div className="mt-6">
      <p className="rec-mono text-[10px] text-blood">Discuss</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[15px]">
        {qs.map((q, i) => <li key={i}>{q}</li>)}
      </ol>
    </div>
  );
}

const num = (s) => Number(String(s ?? '').replace(/[^0-9.]/g, ''));

export function FillIn({ blanks = [], hint, discuss, sourceText, sourceLink, puck, ...head }) {
  const [v, setV] = useState({});
  const [checked, setChecked] = useState(false);
  const ok = (b, i) => Math.abs(num(v[i]) - num(b.answer)) <= num(b.leeway || 0);
  const score = blanks.filter(ok).length;
  return (
    <Sheet {...head} dragRef={puck?.dragRef}>
      <div className="mt-6 text-[17px] leading-[2.4]">
        {blanks.map((b, i) => (
          <span key={i}>
            <span className="rec-mono mr-1 text-[10px] text-ink/50">{String.fromCharCode(97 + i)}.</span>
            {b.before}
            <input
              aria-label={`Blank ${i + 1}`}
              inputMode="numeric"
              value={v[i] ?? ''}
              onChange={(e) => { setV({ ...v, [i]: e.target.value }); setChecked(false); }}
              className={`rec-blank ${String(b.answer).length > 4 ? 'w-24' : 'w-16'} ${checked ? (ok(b, i) ? 'rec-right' : 'rec-wrong') : ''}`}
            />
            {b.after}{' '}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={() => setChecked(true)} className="rec-btn">Check my answers</button>
        <button onClick={() => { setV(Object.fromEntries(blanks.map((b, i) => [i, Number(num(b.answer)).toLocaleString()]))); setChecked(true); }} className="rec-btn-ghost">Show the key</button>
        {checked && <p className="rec-mono text-[11px] text-blood" role="status">{score} of {blanks.length} correct</p>}
      </div>
      {checked && score < blanks.length && hint && <p className="mt-3 text-[15px] italic text-ink/75">{hint}</p>}
      <Discuss items={discuss} />
      <Source text={sourceText} link={sourceLink} />
    </Sheet>
  );
}

const TONE = { red: 'text-blood', navy: 'text-navy', gray: 'text-ink/60' };

export function Docket({ rows = [], discuss, sourceText, sourceLink, puck, ...head }) {
  const [open, setOpen] = useState(0);
  return (
    <Sheet {...head} dragRef={puck?.dragRef}>
      <div className="mt-6 overflow-x-auto">
        <table className="rec-docket w-full min-w-[300px] text-left">
          <thead>
            <tr className="rec-mono text-[10px] text-ink/60">
              <th className="w-8">No.</th><th className="w-14">Term</th><th>Case</th><th className="hidden sm:table-cell">Disposition</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isOpen = open === i;
              return [
                <tr key={i} className={`rec-row ${isOpen ? 'rec-row-open' : ''}`}>
                  <td className="rec-mono text-[11px]">{i + 1}</td>
                  <td className="rec-mono text-[12px]">{r.term}</td>
                  <td>
                    <button onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} className="w-full text-left">
                      <span className="rec-display block text-[1.2rem]">{r.name}</span>
                      <span className="rec-mono block text-[10px] text-blood">{isOpen ? 'Close' : 'Read ruling'}</span>
                      <span className="rec-mono mt-0.5 block text-[10px] text-ink/60 sm:hidden">{r.disposition}</span>
                    </button>
                  </td>
                  <td className="rec-mono hidden text-[11px] sm:table-cell">
                    <span className={TONE[r.tone] || TONE.gray}>{r.disposition}</span>
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`${i}-x`} className="rec-ruling">
                    <td /><td colSpan={3} className="pb-4 text-[16px] leading-relaxed">{r.text}</td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
      <Discuss items={discuss} />
      <Source text={sourceText} link={sourceLink} />
    </Sheet>
  );
}

export function TrueFalse({ questions = [], sourceText, sourceLink, puck, ...head }) {
  const [ans, setAns] = useState({});
  return (
    <Sheet {...head} dragRef={puck?.dragRef}>
      <ol className="mt-6 grid gap-0 md:grid-cols-3">
        {questions.map((q, i) => {
          const truth = q.answer === 'true';
          const pick = ans[i];
          const done = pick !== undefined;
          return (
            <li key={i} className="border-t border-ink/25 py-5 md:border-t-0 md:px-6 md:py-1 md:first:pl-0 md:[&+li]:border-l">
              <p className="rec-mono text-[10px] text-blood">Question {i + 1}</p>
              <p className="rec-display mt-2 text-[1.35rem] leading-snug">{q.statement}</p>
              <div className="mt-4 flex gap-2">
                {[true, false].map((val) => (
                  <button key={String(val)} onClick={() => setAns({ ...ans, [i]: val })} aria-pressed={pick === val}
                    className={`rec-tfbtn ${pick === val ? (val === truth ? 'rec-tf-right' : 'rec-tf-wrong') : ''}`}>
                    {val ? 'True' : 'False'}
                  </button>
                ))}
              </div>
              {done && (
                <div className="mt-4" role="status">
                  <p className="rec-mono text-[11px] text-blood">{pick === truth ? 'Correct' : 'Not quite'}</p>
                  <p className="mt-1 text-[15px] leading-relaxed">{q.note}</p>
                  {q.cite && <p className="rec-mono mt-2 text-[10px] text-ink/55">{q.cite}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <Source text={sourceText} link={sourceLink} />
    </Sheet>
  );
}
