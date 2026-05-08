import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { LandingShell } from './components/LandingShell';
import { getLocalStorageValue, STORAGE_KEYS } from './utils/storage';

interface AppRuntimeProps {
  openWalletOnReady?: boolean;
}

type AppRuntimeComponent = ComponentType<AppRuntimeProps>;

const shouldLoadRuntimeImmediately = () => {
  const searchParams = new URLSearchParams(window.location.search);

  return (
    searchParams.has('code') || getLocalStorageValue(STORAGE_KEYS.DISCORD_OAUTH_STARTED) === 'true'
  );
};

export const AppBootstrap = () => {
  const [Runtime, setRuntime] = useState<AppRuntimeComponent | null>(null);
  const [isRuntimeLoading, setIsRuntimeLoading] = useState(shouldLoadRuntimeImmediately);
  const [openWalletOnReady, setOpenWalletOnReady] = useState(false);
  const runtimePromiseRef = useRef<Promise<{ AppRuntime: AppRuntimeComponent }> | null>(null);

  const loadRuntime = useCallback(
    async ({ openWallet = false }: { openWallet?: boolean } = {}) => {
      if (openWallet) {
        setOpenWalletOnReady(true);
      }

      if (Runtime || runtimePromiseRef.current) {
        return;
      }

      setIsRuntimeLoading(true);
      const runtimePromise = import('./AppRuntime');
      runtimePromiseRef.current = runtimePromise;
      const runtime = await runtimePromise;
      setRuntime(() => runtime.AppRuntime);
      setIsRuntimeLoading(false);
    },
    [Runtime],
  );

  useEffect(() => {
    if (!isRuntimeLoading || Runtime || runtimePromiseRef.current) {
      return;
    }

    const runtimePromise = import('./AppRuntime');
    runtimePromiseRef.current = runtimePromise;

    void runtimePromise.then((runtime) => {
      setRuntime(() => runtime.AppRuntime);
      setIsRuntimeLoading(false);
    });
  }, [Runtime, isRuntimeLoading]);

  if (Runtime) {
    return <Runtime openWalletOnReady={openWalletOnReady} />;
  }

  return (
    <LandingShell
      isRuntimeLoading={isRuntimeLoading}
      onConnectWallet={() => void loadRuntime({ openWallet: true })}
    />
  );
};
