import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkWarning } from './NetworkWarning';

const wagmiState = vi.hoisted(() => ({
  isPending: false,
  switchChain: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useSwitchChain: () => ({
    isPending: wagmiState.isPending,
    switchChain: wagmiState.switchChain,
  }),
}));

vi.mock('wagmi/chains', () => ({
  linea: { id: 59144 },
  lineaSepolia: { id: 59141 },
}));

describe('NetworkWarning', () => {
  beforeEach(() => {
    wagmiState.isPending = false;
    wagmiState.switchChain.mockClear();
  });

  it('does not render when the user is disconnected or already on Linea', () => {
    const { rerender } = render(<NetworkWarning />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    rerender(<NetworkWarning chainId={59144} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers safe network switches from unsupported chains', async () => {
    const user = userEvent.setup();
    render(<NetworkWarning chainId={1} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Wrong Network');

    await user.click(screen.getByRole('button', { name: 'Switch to Linea' }));
    expect(wagmiState.switchChain).toHaveBeenCalledWith({ chainId: 59144 });

    await user.click(screen.getByRole('button', { name: 'Linea Sepolia' }));
    expect(wagmiState.switchChain).toHaveBeenCalledWith({ chainId: 59141 });
  });
});
