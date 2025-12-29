/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_INFURA_API_KEY: string;
  readonly VITE_DISCORD_CLIENT_ID: string;
  readonly VITE_REDIRECT_URL: string;
  readonly VITE_MODE: 'development' | 'production';
  readonly VITE_INSIGHTS_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
