export interface SanctionsProvider {
  checkAddress(
    chain: string,
    address: string
  ): Promise<{ blocked: boolean; reason?: string; version?: string }>;
}