import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App';
import { BingoProvider } from './state/BingoProvider';
import './index.css';

// Standalone-/förhandsbyggen (t.ex. en enda HTML-fil utan server) använder
// HashRouter så att routing fungerar oavsett var filen ligger. Vanliga bygget
// (Vercel) använder BrowserRouter med rena URL:er.
const Router = import.meta.env.VITE_HASH_ROUTER ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <BingoProvider>
        <App />
      </BingoProvider>
    </Router>
  </StrictMode>,
);
