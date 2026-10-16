import { isAddress } from 'viem';
import { describe, expect, it } from 'vitest';

import { PORTAL_ID, PORTAL_ID_TESTNET } from './constants';

describe('constants', () => {
  it.each([PORTAL_ID, PORTAL_ID_TESTNET])('%s is a valid checksummed address', (address) => {
    expect(isAddress(address)).toBe(true);
  });
});
