import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { SpontanProvider } from './state/SpontanProvider';
import './index.css';

// Förhandsbygget (en enda HTML-fil utan server) använder HashRouter så att
// routingen fungerar oavsett var filen ligger. Vanliga bygget använder
// BrowserRouter med rena URL:er.
const Router = import.meta.env.VITE_HASH_ROUTER ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <SpontanProvider>
        <App />
      </SpontanProvider>
    </Router>
  </StrictMode>,
);
