import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

@Injectable()
export class PolymarketHttpService {
  private readonly gammaClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.gammaClient = axios.create({
      baseURL: this.configService.get<string>('polymarket.gammaApiUrl'),
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  get gamma(): AxiosInstance {
    return this.gammaClient;
  }

  async gammaGet<T>(path: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.gammaClient.get<T>(path, config);
  }
}
