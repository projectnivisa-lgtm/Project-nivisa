import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// Same tokens as the shop, so both apps read as one organisation.
import './styles/admin.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Last-resort net: catches errors from Sidebar/Header/App itself, outside
        the per-page boundary in App.tsx, so a broken shell shows a message
        instead of a blank white screen. */}
    <ErrorBoundary section="The dashboard">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
