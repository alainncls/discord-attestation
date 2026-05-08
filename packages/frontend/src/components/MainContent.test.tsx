import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MainContent from './MainContent';
import type { SignedGuild } from '../types';

const guilds: SignedGuild[] = [
  {
    id: '101',
    name: 'Linea Builders',
    signature: '0xsignature',
  },
  {
    id: '202',
    name: 'Verax Members',
    signature: '0xsignature',
    attestationId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  },
];

describe('MainContent', () => {
  it('renders the wallet and Discord login actions for logged-out users', () => {
    render(
      <MainContent
        isLoggedIn={false}
        isLoading={false}
        guilds={[]}
        isWalletConnected={false}
        onAttest={vi.fn()}
        onCheck={vi.fn()}
      />,
    );

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login with Discord' })).toBeInTheDocument();
  });

  it('renders a loading status while Discord guilds are being fetched', () => {
    render(
      <MainContent
        isLoggedIn={false}
        isLoading
        guilds={[]}
        isWalletConnected={false}
        onAttest={vi.fn()}
        onCheck={vi.fn()}
      />,
    );

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Login with Discord' })).not.toBeInTheDocument();
  });

  it('renders guild attestation actions for authenticated users', () => {
    const onAttest = vi.fn();
    const onCheck = vi.fn();

    render(
      <MainContent
        isLoggedIn
        isLoading={false}
        guilds={guilds}
        isWalletConnected
        onAttest={onAttest}
        onCheck={onCheck}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'You are part of 2 Discord Servers' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Attest Linea Builders on Verax' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Check attestation for Verax Members on Verax' }),
    ).toBeInTheDocument();
  });
});
