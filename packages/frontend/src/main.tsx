import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { AppKitProvider } from './AppKitProvider';

// Initialize analytics if configured
const insightsId = import.meta.env.VITE_INSIGHTS_ID;
if (insightsId && typeof insights !== 'undefined') {
  insights.init(insightsId);
  insights.trackPages();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppKitProvider>
      <App />
    </AppKitProvider>
  </StrictMode>,
);
