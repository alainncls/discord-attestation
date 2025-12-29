declare module '*.svg' {
  const content: string;
  export default content;
}

// Insights analytics global (loaded via script tag in index.html)
interface InsightsAnalytics {
  init: (projectId: string) => void;
  trackPages: () => void;
}

declare const insights: InsightsAnalytics | undefined;
