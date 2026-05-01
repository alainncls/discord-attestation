import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { AppKitProvider } from './AppKitProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppKitProvider>
      <App />
    </AppKitProvider>
  </StrictMode>,
);

const loadInsights = () =>
  new Promise<InsightsAnalytics | undefined>((resolve, reject) => {
    if (window.insights) {
      resolve(window.insights);
      return;
    }

    const script = document.createElement('script');
    script.src = '/js/insights-js.umd.min.js';
    script.async = true;
    script.onload = () => resolve(window.insights);
    script.onerror = reject;
    document.head.append(script);
  });

const scheduleAnalytics = (callback: () => void) => {
  const requestIdleCallback = window.requestIdleCallback;
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback, { timeout: 2000 });
    return;
  }

  window.setTimeout(callback, 0);
};

const insightsId = import.meta.env.VITE_INSIGHTS_ID;
if (insightsId) {
  scheduleAnalytics(() => {
    void loadInsights()
      .then((analytics) => {
        analytics?.init(insightsId);
        analytics?.trackPages();
      })
      .catch(() => undefined);
  });
}
