import { createRoot } from 'react-dom/client';
import '@measured/puck/puck.css';
import { Editor } from './Editor';

// Deliberately no site stylesheet import here: the canvas gets the page's stylesheet,
// scoped, at runtime (scope-css.js). Loading it globally would restyle Puck's own panels.
createRoot(document.getElementById('root')).render(<Editor />);
