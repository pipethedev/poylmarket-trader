import { MarketFactory } from './market.factory';
import { Market } from '@database/entities/market.entity';
import type { ProviderMarket } from '@app-types/index';

describe('MarketFactory', () => {
  const mockProviderMarket: ProviderMarket = {
    id: 'market-123',
    eventId: 'event-456',
    conditionId: 'condition-789',
    question: 'Will it rain tomorrow?',
    description: 'Market description',
    outcomeYesPrice: '0.65',
    outcomeNoPrice: '0.35',
    volume: '10000',
    liquidity: '5000',
    active: true,
    closed: false,
    tokens: [],
    metadata: { category: 'weather' },
  };

  describe('create', () => {
    it('should create market data from provider market', () => {
      const result = MarketFactory.create(mockProviderMarket, 1, 'polymarket');

      expect(result.externalId).toBe('market-123');
      expect(result.provider).toBe('polymarket');
      expect(result.eventId).toBe(1);
      expect(result.conditionId).toBe('condition-789');
      expect(result.question).toBe('Will it rain tomorrow?');
      expect(result.description).toBe('Market description');
      expect(result.outcomeYesPrice).toBe('0.65');
      expect(result.outcomeNoPrice).toBe('0.35');
      expect(result.volume).toBe('10000');
      expect(result.liquidity).toBe('5000');
      expect(result.active).toBe(true);
      expect(result.closed).toBe(false);
      expect(result.metadata).toEqual({ category: 'weather' });
    });

    it('should handle null optional fields', () => {
      const minimalMarket: ProviderMarket = {
        id: 'market-456',
        eventId: 'event-789',
        question: 'Minimal market?',
        outcomeYesPrice: '0.50',
        outcomeNoPrice: '0.50',
        active: true,
        closed: false,
        tokens: [],
      };

      const result = MarketFactory.create(minimalMarket, 2, 'polymarket');

      expect(result.externalId).toBe('market-456');
      expect(result.provider).toBe('polymarket');
      expect(result.eventId).toBe(2);
      expect(result.conditionId).toBeNull();
      expect(result.description).toBeNull();
      expect(result.volume).toBeNull();
      expect(result.liquidity).toBeNull();
      expect(result.metadata).toBeNull();
    });
  });

  describe('update', () => {
    it('should update existing market with provider data', () => {
      const existingMarket = new Market();
      existingMarket.id = 1;
      existingMarket.externalId = 'market-123';
      existingMarket.question = 'Old question?';
      existingMarket.outcomeYesPrice = '0.40';

      const result = MarketFactory.update(existingMarket, mockProviderMarket);

      expect(result.id).toBe(1);
      expect(result.question).toBe('Will it rain tomorrow?');
      expect(result.outcomeYesPrice).toBe('0.65');
      expect(result.outcomeNoPrice).toBe('0.35');
      expect(result.active).toBe(true);
    });

    it('should set null for undefined optional fields', () => {
      const existingMarket = new Market();
      existingMarket.volume = '5000';

      const minimalMarket: ProviderMarket = {
        id: 'market-456',
        eventId: 'event-789',
        question: 'Updated question?',
        outcomeYesPrice: '0.60',
        outcomeNoPrice: '0.40',
        active: false,
        closed: true,
        tokens: [],
      };

      const result = MarketFactory.update(existingMarket, minimalMarket);

      expect(result.question).toBe('Updated question?');
      expect(result.volume).toBeNull();
      expect(result.liquidity).toBeNull();
      expect(result.closed).toBe(true);
    });
  });
});

