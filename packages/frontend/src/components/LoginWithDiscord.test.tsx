import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoginWithDiscord from './LoginWithDiscord';

describe('LoginWithDiscord', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requires a supported connected wallet before starting OAuth', () => {
    render(<LoginWithDiscord />);

    expect(screen.getByRole('button', { name: 'Login with Discord' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Connect a wallet on Linea');
  });

  it('requests server-issued state with credentials and accepts only Discord authorization URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          authorizeUrl:
            'https://discord.com/api/oauth2/authorize?client_id=client&state=server-state',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const onAuthorize = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <LoginWithDiscord
        address="0x0000000000000000000000000000000000000001"
        chainId={59144}
        onAuthorize={onAuthorize}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Login with Discord' }));
    await waitFor(() => expect(onAuthorize).toHaveBeenCalledOnce());

    expect(fetchMock).toHaveBeenCalledWith(
      '/.netlify/functions/api',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          action: 'start',
          subject: '0x0000000000000000000000000000000000000001',
          chainId: '59144',
        }),
      }),
    );
    expect(onAuthorize).toHaveBeenCalledWith(
      'https://discord.com/api/oauth2/authorize?client_id=client&state=server-state',
    );
  });

  it('rejects a non-Discord URL from the start endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ authorizeUrl: 'https://attacker.example/authorize' }), {
        status: 200,
      }),
    );
    const onAuthorize = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(
      <LoginWithDiscord
        address="0x0000000000000000000000000000000000000001"
        chainId={59144}
        onAuthorize={onAuthorize}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Login with Discord' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid Discord authorization URL');
    expect(onAuthorize).not.toHaveBeenCalled();
  });
});
