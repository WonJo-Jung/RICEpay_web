// 4. 환율 관련 공용 타입 정의. 서비스/프로바이더/컨트롤러가 모두 공통으로 사용
export interface RateQuote {
  base: "USD";
  quote: string;
  rate: number;
  asOf: Date;
  source: string;
  stale?: boolean;
}
export interface RateProvider {
  getRate(base: "USD", quote: string): Promise<RateQuote>;
}