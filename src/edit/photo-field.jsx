/* The photo field: tap, pick from the phone or computer, done.

   A picked photo is downscaled on a canvas (max 1600px on the long side, JPEG 0.85) before
   anything else happens. That keeps a 12MB phone photo off the page, and it strips the EXIF
   block, which on a phone photo carries GPS coordinates.

   Nothing uploads at pick time. The field stores the path the photo WILL have on the site
   (/images/uploads/<name>.jpg), the bytes wait in `pending`, and Publish commits them to the
   repo alongside page.json in one commit. Until then the canvas shows the photo from memory
   via photoSrc(), so what is on screen is what will ship. (Ported from Vaccar's editor.) */

import { useRef, useState } from 'react';

const MAX_DIM = 1600;
export const PHOTO_DIR = 'public/images/uploads';
export const PUBLIC_DIR = '/images/uploads';

/** Photos picked in this session, keyed by their site path. Consumed by Publish. */
export const pending = new Map();

/** What to put in an <img> for a site path: the in-memory preview until it is published. */
export const photoSrc = (path) => pending.get(path)?.preview ?? path;

/** Every upload path the page still uses, found anywhere in the page data. */
export function referencedPhotos(data) {
  const found = new Set();
  const walk = (v) => {
    if (typeof v === 'string') { if (v.startsWith(`${PUBLIC_DIR}/`)) found.add(v); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(data);
  return found;
}

/** The repo paths + base64 bodies Publish should commit, for the photos the page still references. */
export function pendingFiles(referenced) {
  return [...pending.entries()]
    .filter(([sitePath]) => referenced.has(sitePath))
    .map(([sitePath, v]) => ({ path: `${PHOTO_DIR}/${sitePath.slice(PUBLIC_DIR.length + 1)}`, base64: v.base64 }));
}

export function clearPending() {
  pending.clear();
}

async function downscale(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('this browser could not process the photo');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error('could not encode the photo'))), 'image/jpeg', 0.85));
}

const toBase64 = (blob) =>
  new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => fail(new Error('could not read the photo'));
    r.readAsDataURL(blob);
  });

/** A stable, URL-safe file name from the original, plus a stamp so re-uploads never collide. */
function siteName(original) {
  const base = original.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo';
  return `${base}-${Date.now().toString(36)}.jpg`;
}

function PhotoInput({ value, onChange, label }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const blob = await downscale(file);
      const base64 = await toBase64(blob);
      const path = `${PUBLIC_DIR}/${siteName(file.name)}`;
      pending.set(path, { base64, preview: `data:image/jpeg;base64,${base64}` });
      onChange(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const preview = value ? photoSrc(value) : '';
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {preview ? (
        <img src={preview} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }} />
      ) : (
        <div style={{ height: 64, borderRadius: 6, border: '1px dashed #bbb', display: 'grid', placeItems: 'center', fontSize: 12, color: '#777' }}>No photo yet</div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => input.current?.click()} disabled={busy} style={btn}>
          {busy ? 'Preparing…' : value ? 'Replace photo' : 'Choose photo'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')} disabled={busy} style={{ ...btn, background: 'transparent', color: '#555' }}>
            Remove
          </button>
        )}
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} aria-label={label} />
      </div>
      {error && <p role="alert" style={{ fontSize: 12, color: '#b8400f', margin: 0 }}>That photo did not go through: {error}. The old one is untouched.</p>}
    </div>
  );
}

const btn = { font: 'inherit', fontSize: 13, padding: '6px 12px', borderRadius: 6, border: '1px solid #bbb', background: '#f4f4f4', cursor: 'pointer' };

/** A drop-in Puck field: photoField("Photo") wherever a bare URL text field would be. */
export function photoField(label) {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange }) => <PhotoInput value={value ?? ''} onChange={onChange} label={label} />,
  };
}
