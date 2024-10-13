export interface Guild {
  id: string;
  name: string;
}

export type SignedGuild = Guild & { signature: string, attestationId?: string };

interface DecodedPayload {
  guildId: string;
}
