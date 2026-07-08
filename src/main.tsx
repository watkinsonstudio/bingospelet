import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { BingoProvider } from './state/BingoProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <BingoProvider>
        <App />
      </BingoProvider>
    </BrowserRouter>
  </StrictMode>,
);
