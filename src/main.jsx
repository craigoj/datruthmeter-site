import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Render } from '@measured/puck/rsc';
import './index.css';
import { makeConfig } from './site/config';
import page from './content/page.json';

/* The public page. It renders src/content/page.json, which is what the editor at /edit
   writes. Render-only import: none of the editor ships to visitors. */
const config = makeConfig();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Render config={config} data={page} />
  </StrictMode>
);
