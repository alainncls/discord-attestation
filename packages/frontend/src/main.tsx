import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './App.css';
import { AppBootstrap } from './AppBootstrap';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing #root element');

createRoot(rootElement).render(
  <StrictMode>
    <AppBootstrap />
  </StrictMode>,
);

const loadInsights = () =>
  new Promise<InsightsAnalytics | undefined>((resolve, reject) => {
    if (window.insights) {
      resolve(window.insights);
      return;
    }

    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}js/insights-js.umd.min.js`;
    script.async = true;
    script.onload = () => {
      resolve(window.insights);
    };
    script.onerror = reject;
    document.head.append(script);
  });

const scheduleAnalytics = (callback: () => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(callback, { timeout: 2000 });
    return;
  }

  window.setTimeout(callback, 0);
};

const insightsId = import.meta.env.VITE_INSIGHTS_ID;
if (insightsId && location.hostname !== 'alainnicolas.fr') {
  scheduleAnalytics(() => {
    void loadInsights()
      .then((analytics) => {
        analytics?.init(insightsId);
        analytics?.trackPages();
      })
      .catch(() => undefined);
  });
}
