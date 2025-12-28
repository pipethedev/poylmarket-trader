import { Test, TestingModule } from '@nestjs/testing';
import { SignatureValidationService } from './signature-validation.service';
import { AppLogger } from '@common/logger/app-logger.service';
import * as wallet from '@ethersproject/wallet';

jest.mock('@ethersproject/wallet');

describe('SignatureValidationService', () => {
  let service: SignatureValidationService;
  let mockLogger: jest.Mocked<AppLogger>;

  beforeEach(async () => {
    mockLogger = {
      setPrefix: jest.fn().mockReturnThis(),
      setContext: jest.fn().mockReturnThis(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignatureValidationService,
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<SignatureValidationService>(SignatureValidationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyMessage', () => {
    const testMessage = 'Test message';
    const testSignature = '0xabcd...signature';
    const testAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

    it('should return true for valid signature', () => {
      (wallet.verifyMessage as jest.Mock).mockReturnValue(testAddress);

      const result = service.verifyMessage(testMessage, testSignature, testAddress);

      expect(result).toBe(true);
      expect(wallet.verifyMessage).toHaveBeenCalledWith(testMessage, testSignature);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return true for valid signature with different case', () => {
      const lowerCaseAddress = testAddress.toLowerCase();
      const upperCaseAddress = testAddress.toUpperCase();

      (wallet.verifyMessage as jest.Mock).mockReturnValue(lowerCaseAddress);

      const result = service.verifyMessage(testMessage, testSignature, upperCaseAddress);

      expect(result).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should return false for invalid signature (wrong address)', () => {
      const wrongAddress = '0x0000000000000000000000000000000000000000';
      (wallet.verifyMessage as jest.Mock).mockReturnValue(wrongAddress);

      const result = service.verifyMessage(testMessage, testSignature, testAddress);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Signature validation failed'));
    });

    it('should log recovered and expected addresses on failure', () => {
      const recoveredAddress = '0x1111111111111111111111111111111111111111';
      (wallet.verifyMessage as jest.Mock).mockReturnValue(recoveredAddress);

      service.verifyMessage(testMessage, testSignature, testAddress);

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(recoveredAddress));
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(testAddress));
    });

    it('should return false and log error on exception', () => {
      const error = new Error('Invalid signature format');
      (wallet.verifyMessage as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const result = service.verifyMessage(testMessage, testSignature, testAddress);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error verifying signature: Invalid signature format'));
    });

    it('should handle malformed signature', () => {
      const malformedSignature = 'not-a-valid-signature';
      (wallet.verifyMessage as jest.Mock).mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const result = service.verifyMessage(testMessage, malformedSignature, testAddress);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle empty message', () => {
      (wallet.verifyMessage as jest.Mock).mockReturnValue(testAddress);

      service.verifyMessage('', testSignature, testAddress);

      expect(wallet.verifyMessage).toHaveBeenCalledWith('', testSignature);
    });

    it('should be case-insensitive for address comparison', () => {
      const mixedCaseAddress = '0xAbCd...';
      (wallet.verifyMessage as jest.Mock).mockReturnValue(mixedCaseAddress.toLowerCase());

      const result = service.verifyMessage(testMessage, testSignature, mixedCaseAddress.toUpperCase());

      expect(result).toBe(true);
    });
  });
});
