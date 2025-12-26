import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse, AxiosHeaders } from 'axios';
import { PolymarketHttpService } from './polymarket-http.service';

const mockGet = jest.fn();
const mockAxiosInstance = {
  get: mockGet,
};

jest.mock('axios', () => ({
  ...jest.requireActual('axios'),
  create: jest.fn(() => mockAxiosInstance),
}));

describe('PolymarketHttpService', () => {
  let service: PolymarketHttpService;

  beforeEach(async () => {
    mockGet.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolymarketHttpService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'polymarket.gammaApiUrl') return 'https://gamma-api.polymarket.com';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PolymarketHttpService>(PolymarketHttpService);
  });

  describe('gammaGet', () => {
    it('should make GET request to gamma API', async () => {
      const mockData = [{ id: 'event-1' }];
      const mockResponse: AxiosResponse = {
        data: mockData,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: new AxiosHeaders() },
      };
      mockGet.mockResolvedValue(mockResponse);

      const result = await service.gammaGet('/events', { params: { limit: 100 } });

      expect(result.data).toEqual(mockData);
      expect(mockGet).toHaveBeenCalledWith('/events', { params: { limit: 100 } });
    });

    it('should handle request without config', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: { headers: new AxiosHeaders() },
      };
      mockGet.mockResolvedValue(mockResponse);

      await service.gammaGet('/events');

      expect(mockGet).toHaveBeenCalledWith('/events', undefined);
    });

    it('should propagate errors', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));

      await expect(service.gammaGet('/events')).rejects.toThrow('Network error');
    });
  });

  describe('gamma', () => {
    it('should return the gamma client', () => {
      expect(service.gamma).toBeDefined();
    });
  });
});
