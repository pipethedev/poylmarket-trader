import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MARKET_PROVIDER, type IMarketProvider } from './market-provider.interface';
import type { AppConfig } from '@app-types/index';

@Injectable()
export class ProviderManagerService {
  private readonly defaultProviderName: string;

  constructor(
    @Inject(MARKET_PROVIDER)
    private readonly marketProvider: IMarketProvider,
    private readonly configService: ConfigService<AppConfig>,
  ) {
    //On a good day, this logic is expected to change based on success rates, frequency of errors and business decisions
    this.defaultProviderName = this.configService.get('defaultProvider', {
      infer: true,
    })!;
  }

  getProvider(): IMarketProvider {
    return this.marketProvider;
  }

  getDefaultProviderName(): string {
    return this.defaultProviderName;
  }

  getCurrentProviderName(): string {
    return this.marketProvider.getName();
  }

  isCurrentProvider(providerName: string): boolean {
    return this.getCurrentProviderName() === providerName;
  }
}
