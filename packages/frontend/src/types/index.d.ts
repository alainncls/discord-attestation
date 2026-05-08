import { Hex } from 'viem';

export interface Guild {
  id: string;
  name: string;
}

export interface SignedGuild extends Guild {
  signature: string;
  expirationDate: number;
  attestationId?: Hex;
}

export interface DecodedPayload {
  guildId: bigint;
}
