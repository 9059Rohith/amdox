import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface FxRate {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

@Injectable()
export class FxRatesService {
  private readonly logger = new Logger(FxRatesService.name);
  private cachedRates: FxRate | null = null;

  constructor(private configService: ConfigService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async fetchAndCacheRates() {
    try {
      const apiKey = this.configService.get<string>('OPEN_EXCHANGE_RATES_API_KEY');
      if (apiKey) {
        const resp = await axios.get(`https://openexchangerates.org/api/latest.json?app_id=${apiKey}`);
        this.cachedRates = resp.data;
        this.logger.log(`FX rates updated via OpenExchangeRates (${Object.keys(resp.data.rates).length} currencies)`);
        return;
      }
    } catch (err) {
      this.logger.warn('OpenExchangeRates failed, falling back to ECB');
    }

    // ECB fallback
    try {
      const resp = await axios.get('https://api.frankfurter.app/latest');
      this.cachedRates = {
        base: resp.data.base,
        rates: { ...resp.data.rates, [resp.data.base]: 1 },
        timestamp: Date.now(),
      };
      this.logger.log(`FX rates updated via ECB/Frankfurter`);
    } catch (err) {
      this.logger.error('Failed to fetch FX rates from all sources', err);
    }
  }

  getRate(from: string, to: string): number {
    if (!this.cachedRates) return 1;
    if (from === to) return 1;
    const rates = this.cachedRates.rates;
    const fromRate = rates[from];
    const toRate = rates[to];
    if (!fromRate || !toRate) return 1;
    // Convert via USD base
    return toRate / fromRate;
  }

  getAllRates() {
    return this.cachedRates;
  }
}
