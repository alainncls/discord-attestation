import { useEffect, useRef } from 'react';
import { useAppKit } from '@reown/appkit/react';
import App from './App';
import { AppKitProvider } from './AppKitProvider';

interface AppRuntimeProps {
  openWalletOnReady?: boolean;
}

const WalletAutopener = ({ enabled }: { enabled: boolean }) => {
  const { open } = useAppKit();
  const hasOpened = useRef(false);

  useEffect(() => {
    if (!enabled || hasOpened.current) {
      return;
    }

    hasOpened.current = true;
    void open();
  }, [enabled, open]);

  return null;
};

export const AppRuntime = ({ openWalletOnReady = false }: AppRuntimeProps) => {
  return (
    <AppKitProvider>
      <WalletAutopener enabled={openWalletOnReady} />
      <App />
    </AppKitProvider>
  );
};
