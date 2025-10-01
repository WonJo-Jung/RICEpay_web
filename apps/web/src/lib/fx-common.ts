export type FxResponse = {
  base: 'USD';
  quote: 'MXN';
  rate: number;
  asOf: string;
  source: string;
  stale: boolean;
  ttlSeconds: number;
  disclaimer: string;
};

export class FxError extends Error {
  constructor(
    message: string,
    public status?: number,
    public cause?: unknown
  ) {
    super(message);
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;
const PREFIX = process.env.NEXT_PUBLIC_GLOBAL_PREFIX!;
export const fxUrl = () => `${API_BASE}/${PREFIX}/fx?base=USD&quote=MXN`;