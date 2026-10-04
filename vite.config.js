import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/* The repo the editor reads and writes, taken from Netlify's build environment so a repo
   transfer (CTRL Tech's GitHub to Tim's) needs no code change. src/edit/repo.js explains. */
const repoFromEnv = (() => {
  const m = /github\.com[/:]([^/]+\/[^/.]+)/.exec(process.env.REPOSITORY_URL || '');
  return m ? m[1] : '';
})();

export default defineConfig({
  define: { __REPO__: JSON.stringify(repoFromEnv) },
  plugins: [react(), tailwindcss()],
  // Two pages: the site at / and its editor at /edit.
  build: {
    rollupOptions: { input: { main: 'index.html', edit: 'edit/index.html' } },
  },
});
