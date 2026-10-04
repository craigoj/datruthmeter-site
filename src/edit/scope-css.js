/**
 * The page's own stylesheet, scoped to the editor canvas.
 *
 * The editor page must not load Tailwind globally: its preflight (`* { margin:0; border:0
 * solid }`, button and heading resets) would restyle Puck's own panels, which share the
 * document with the canvas. And Puck mirrors host <style> elements into the canvas iframe
 * but not <link>, so the stylesheet has to be inline anyway.
 *
 * So the editor fetches the SAME compiled CSS the public page uses and rewrites it, in the
 * browser, into `@scope (.dtm) { ... }`. Same file, same bytes, one wrapper: what the
 * canvas renders is what the site ships. This was verified as a 0-pixel diff against the
 * live page at 1280 and 375 on Vaccar (2026-09-04); ported here unchanged.
 *
 * Two rewrites are not optional:
 *   - Document-level selectors (:root, html, body) match nothing inside a scope, so they
 *     become `:scope`, i.e. the page root.
 *   - Tailwind's cascade layers are unwrapped. Puck's stylesheet is unlayered, and an
 *     unlayered rule outranks every layered one, so with layers kept a Puck reset would
 *     silently zero the page's margins. Unlayered, utilities win on specificity and
 *     Tailwind's own base-before-utilities order is kept by source order.
 */

/** Top-level statements of a stylesheet, respecting nesting and quoted strings. */
function topLevel(text) {
  const out = [];
  let depth = 0, start = 0, quote = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === "\\") i++; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { out.push(text.slice(start, i + 1)); start = i + 1; } }
    else if (ch === ";" && depth === 0) { out.push(text.slice(start, i + 1)); start = i + 1; }
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** A statement without the comments in front of it (dev output leads `@layer theme` with Tailwind's banner). */
const bare = (s) => s.replace(/^(\/\*[\s\S]*?\*\/\s*)+/, "");
const hoist = (s) => /^@(import|property|keyframes|font-face)\b/.test(bare(s));
const drop = (s) => /^@layer\b/.test(bare(s)) && s.endsWith(";");
const unlayer = (s) => {
  const b = bare(s);
  return /^@layer\b/.test(b) && b.endsWith("}") ? b.slice(b.indexOf("{") + 1, -1) : s;
};

export function scopeCss(css, root = ".dtm") {
  const stmts = topLevel(css);
  const head = stmts.filter(hoist);
  const body = stmts
    .filter((s) => !hoist(s) && !drop(s))
    .map(unlayer)
    .join("\n")
    /* Whitespace-tolerant on purpose: the production stylesheet is minified (`:root,:host{`),
       Vite's dev server serves it unminified (`:root, :host {`), and the canvas has to be
       right in both or the theme variables never reach the scope root. */
    .replace(/:root\s*,\s*:host\s*\{/g, ":scope{")
    .replace(/html\s*,\s*:host\s*\{/g, ":scope{")
    .replace(/(^|[{};\n])(\s*)html\s*\{/g, "$1$2:scope{")
    .replace(/(^|[{};\n])(\s*)body\s*\{/g, "$1$2:scope{");
  return `${head.join("\n")}\n@scope (${root}) {\n${body}\n}\n`;
}

/** Fetch the page's compiled stylesheet. Vite serves it processed in dev with ?direct. */
export async function loadPageCss(url) {
  const res = await fetch(import.meta.env.DEV ? `${url}${url.includes("?") ? "&" : "?"}direct` : url);
  if (!res.ok) throw new Error(`could not load the site's stylesheet (${res.status})`);
  return res.text();
}
