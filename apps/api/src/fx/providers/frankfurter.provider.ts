import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RateProvider, RateQuote } from '../types';

@Injectable()
export class FrankfurterProvider implements RateProvider {
  constructor(private http: HttpService) {}
  async getRate(base: 'USD', quote: string): Promise<RateQuote> {
    const url = `https://api.frankfurter.app/latest?from=${base}&to=${quote}`;
    const { data } = await firstValueFrom(this.http.get(url));
    const rate = Number(data?.rates?.[quote]);
    if (!rate) throw new Error('FRANK_NO_RATE');
    return {
      base, quote, rate,
      asOf: new Date(data?.date ?? Date.now()),
      source: 'frankfurter(ECB)',
    };
  }
}