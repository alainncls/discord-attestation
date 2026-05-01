declare module '*.svg' {
  const content: string;
  export default content;
}

interface InsightsAnalytics {
  init: (projectId: string) => void;
  trackPages: () => void;
}

interface Window {
  insights?: InsightsAnalytics;
}
