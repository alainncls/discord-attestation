/**
 * Truncates a hexadecimal string for display purposes
 * @param hexString The string to truncate
 * @returns The truncated string with ellipsis in the middle
 */
export const truncateHexString = (hexString: string): string => {
  return `${hexString.slice(0, 7)}...${hexString.slice(hexString.length - 5)}`;
};
