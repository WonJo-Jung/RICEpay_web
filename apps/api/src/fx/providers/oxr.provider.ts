import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { RateProvider, RateQuote } from '../types';

@Injectable()
export class OxrProvider implements RateProvider {
  constructor(private http: HttpService, private cfg: ConfigService) {}
  async getRate(base: 'USD', quote: string): Promise<RateQuote> {
    const appId = this.cfg.get<string>('OXR_APP_ID');
    if (!appId) throw new Error('OXR_APP_ID_MISSING');
    const url = `https://openexchangerates.org/api/latest.json?app_id=${appId}&base=${base}&symbols=${quote}`;
    const { data } = await firstValueFrom(this.http.get(url));
    const rate = Number(data?.rates?.[quote]);
    if (!rate) throw new Error('OXR_NO_RATE');
    const ts = (data?.timestamp ?? Math.floor(Date.now()/1000)) * 1000;
    return { base, quote, rate, asOf: new Date(ts), source: 'openexchangerates' };
  }
}