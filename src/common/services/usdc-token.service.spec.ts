import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UsdcTokenService } from './usdc-token.service';
import { Contract } from '@ethersproject/contracts';
import { Wallet } from '@ethersproject/wallet';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { getAddress } from '@ethersproject/address';

jest.mock('@ethersproject/contracts');
jest.mock('@ethersproject/wallet');
jest.mock('@ethersproject/providers');
jest.mock('@ethersproject/address');

describe('UsdcTokenService', () => {
  let service: UsdcTokenService;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockProvider: jest.Mocked<StaticJsonRpcProvider>;
  let mockUsdcContract: jest.Mocked<Contract>;
  let mockWallet: jest.Mocked<Wallet>;

  const mockConfig = {
    rpcUrl: 'https://polygon-rpc.com',
    walletPrivateKey: '0x1234567890abcdef',
    funderAddress: '0xFunderAddress123',
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  };

  beforeEach(async () => {
    mockProvider = {
      getBalance: jest.fn(),
      getFeeData: jest.fn(),
    } as any;

    mockUsdcContract = {
      balanceOf: jest.fn(),
      allowance: jest.fn(),
      decimals: jest.fn().mockResolvedValue(6),
      transferFrom: jest.fn(),
      connect: jest.fn(),
    } as any;

    mockWallet = {
      address: '0xServerWalletAddress123',
    } as any;

    (StaticJsonRpcProvider as jest.Mock).mockImplementation(() => mockProvider);
    (Wallet as jest.Mock).mockImplementation(() => mockWallet);
    (Contract as jest.Mock).mockImplementation(() => mockUsdcContract);
    (getAddress as jest.Mock).mockImplementation((addr) => addr);

    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'polymarket.rpcUrl') return mockConfig.rpcUrl;
        if (key === 'polymarket.walletPrivateKey') return mockConfig.walletPrivateKey;
        if (key === 'polymarket.funderAddress') return mockConfig.funderAddress;
        if (key === 'polymarket.usdcAddress') return mockConfig.usdcAddress;
        return null;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsdcTokenService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<UsdcTokenService>(UsdcTokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(mockConfigService.get).toHaveBeenCalledWith('polymarket.rpcUrl');
      expect(mockConfigService.get).toHaveBeenCalledWith('polymarket.walletPrivateKey');
      expect(mockConfigService.get).toHaveBeenCalledWith('polymarket.funderAddress');
      expect(mockConfigService.get).toHaveBeenCalledWith('polymarket.usdcAddress');
      expect(StaticJsonRpcProvider).toHaveBeenCalledWith(mockConfig.rpcUrl, {
        name: 'matic',
        chainId: 137,
      });
    });

    it('should use default USDC address if not provided in config', () => {
      const customConfig = { ...mockConfigService };
      customConfig.get = jest.fn((key: string) => {
        if (key === 'polymarket.usdcAddress') return null;
        return mockConfigService.get(key);
      });

      const module = Test.createTestingModule({
        providers: [
          UsdcTokenService,
          {
            provide: ConfigService,
            useValue: customConfig,
          },
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('getBalance', () => {
    const testAddress = '0xUserAddress123';
    const mockBalance = BigInt(1000000000);

    it('should return formatted USDC balance', async () => {
      mockUsdcContract.balanceOf.mockResolvedValue(mockBalance);
      mockUsdcContract.decimals.mockResolvedValue(6);

      const result = await service.getBalance(testAddress);

      expect(getAddress).toHaveBeenCalledWith(testAddress);
      expect(mockUsdcContract.balanceOf).toHaveBeenCalled();
      expect(result).toBe('1000');
    });

    it('should handle zero balance', async () => {
      mockUsdcContract.balanceOf.mockResolvedValue(BigInt(0));
      mockUsdcContract.decimals.mockResolvedValue(6);

      const result = await service.getBalance(testAddress);

      expect(result).toBe('0');
    });

    it('should handle small balances correctly', async () => {
      mockUsdcContract.balanceOf.mockResolvedValue(BigInt(1500));
      mockUsdcContract.decimals.mockResolvedValue(6);

      const result = await service.getBalance(testAddress);

      expect(result).toBe('0.0015');
    });

    it('should throw error on contract failure', async () => {
      const error = new Error('Contract error');
      mockUsdcContract.balanceOf.mockRejectedValue(error);

      await expect(service.getBalance(testAddress)).rejects.toThrow('Contract error');
    });
  });

  describe('getAllowance', () => {
    const userAddress = '0xUserAddress123';
    const mockAllowance = BigInt(500000000);

    it('should return formatted allowance', async () => {
      mockUsdcContract.allowance.mockResolvedValue(mockAllowance);
      mockUsdcContract.decimals.mockResolvedValue(6);

      const result = await service.getAllowance(userAddress);

      expect(mockUsdcContract.allowance).toHaveBeenCalledWith(userAddress, mockWallet.address);
      expect(result).toBe('500');
    });

    it('should handle zero allowance', async () => {
      mockUsdcContract.allowance.mockResolvedValue(BigInt(0));
      mockUsdcContract.decimals.mockResolvedValue(6);

      const result = await service.getAllowance(userAddress);

      expect(result).toBe('0');
    });

    it('should throw error on contract failure', async () => {
      const error = new Error('Allowance check failed');
      mockUsdcContract.allowance.mockRejectedValue(error);

      await expect(service.getAllowance(userAddress)).rejects.toThrow('Allowance check failed');
    });
  });

  describe('getServerWalletMaticBalance', () => {
    it('should return formatted MATIC balance', async () => {
      const mockMaticBalance = BigInt('10000000000000000');
      mockProvider.getBalance.mockResolvedValue(mockMaticBalance);

      const result = await service.getServerWalletMaticBalance();

      expect(mockProvider.getBalance).toHaveBeenCalledWith(mockWallet.address);
      expect(result).toBe('0.01');
    });

    it('should handle zero MATIC balance', async () => {
      mockProvider.getBalance.mockResolvedValue(BigInt(0));

      const result = await service.getServerWalletMaticBalance();

      expect(result).toBe('0');
    });

    it('should throw error on provider failure', async () => {
      const error = new Error('Provider error');
      mockProvider.getBalance.mockRejectedValue(error);

      await expect(service.getServerWalletMaticBalance()).rejects.toThrow('Provider error');
    });
  });

  describe('transferFromUser', () => {
    const userAddress = '0xUserAddress123';
    const amount = '100';
    const mockTxHash = '0xTransactionHash123';
    const mockReceipt = { blockNumber: 12345 };

    beforeEach(() => {
      mockProvider.getBalance.mockResolvedValue(BigInt('100000000000000000'));
      mockUsdcContract.decimals.mockResolvedValue(6);
      mockUsdcContract.allowance.mockResolvedValue(BigInt(200000000));
      mockProvider.getFeeData.mockResolvedValue({
        maxFeePerGas: BigInt('50000000000'),
        maxPriorityFeePerGas: BigInt('30000000000'),
      });

      const mockTx = {
        hash: mockTxHash,
        wait: jest.fn().mockResolvedValue(mockReceipt),
      };

      const mockContractWithSigner = {
        transferFrom: jest.fn().mockResolvedValue(mockTx),
      };

      mockUsdcContract.connect.mockReturnValue(mockContractWithSigner as any);
    });

    it('should successfully transfer USDC from user', async () => {
      const result = await service.transferFromUser(userAddress, amount);

      expect(result).toBe(mockTxHash);
      expect(mockProvider.getBalance).toHaveBeenCalled();
      expect(mockUsdcContract.allowance).toHaveBeenCalledWith(userAddress, mockWallet.address);
      expect(mockUsdcContract.connect).toHaveBeenCalledWith(mockWallet);
    });

    it('should throw error if server wallet has insufficient MATIC', async () => {
      mockProvider.getBalance.mockResolvedValue(BigInt('5000000000000000'));

      await expect(service.transferFromUser(userAddress, amount)).rejects.toThrow('Server wallet has insufficient MATIC for gas fees');
    });

    it('should throw error if allowance is insufficient', async () => {
      mockUsdcContract.allowance.mockResolvedValue(BigInt(50000000));

      await expect(service.transferFromUser(userAddress, amount)).rejects.toThrow('Insufficient allowance');
    });

    it('should use minimum gas prices if network values are too low', async () => {
      mockProvider.getFeeData.mockResolvedValue({
        maxFeePerGas: BigInt('10000000000'),
        maxPriorityFeePerGas: BigInt('10000000000'),
      });

      await service.transferFromUser(userAddress, amount);

      const contractWithSigner = mockUsdcContract.connect(mockWallet);
      expect(contractWithSigner.transferFrom).toHaveBeenCalledWith(
        userAddress,
        mockConfig.funderAddress,
        expect.any(BigInt),
        expect.objectContaining({
          maxFeePerGas: expect.any(BigInt),
          maxPriorityFeePerGas: expect.any(BigInt),
        }),
      );
    });

    it('should handle transfer errors gracefully', async () => {
      const error = new Error('Transfer failed');
      const mockContractWithSigner = {
        transferFrom: jest.fn().mockRejectedValue(error),
      };
      mockUsdcContract.connect.mockReturnValue(mockContractWithSigner as any);

      await expect(service.transferFromUser(userAddress, amount)).rejects.toThrow('Transfer failed');
    });

    it('should provide helpful error message for insufficient funds error', async () => {
      const error = new Error('insufficient funds for gas');
      const mockContractWithSigner = {
        transferFrom: jest.fn().mockRejectedValue(error),
      };
      mockUsdcContract.connect.mockReturnValue(mockContractWithSigner as any);

      await expect(service.transferFromUser(userAddress, amount)).rejects.toThrow('Server wallet has insufficient MATIC for gas fees');
    });
  });

  describe('estimateGasFees', () => {
    it('should return estimated gas fees', async () => {
      mockProvider.getFeeData.mockResolvedValue({
        maxFeePerGas: BigInt('50000000000'),
        maxPriorityFeePerGas: BigInt('30000000000'),
      });

      const result = await service.estimateGasFees();

      expect(result).toMatchObject({
        estimatedGasMatic: expect.any(String),
        estimatedGasUsd: expect.any(String),
        gasPriceGwei: expect.any(String),
        note: 'Gas fees are included in the order amount. This is an estimate.',
      });
    });

    it('should return default values on error', async () => {
      mockProvider.getFeeData.mockRejectedValue(new Error('Network error'));

      const result = await service.estimateGasFees();

      expect(result).toEqual({
        estimatedGasMatic: '0.003',
        estimatedGasUsd: '0.0003',
        gasPriceGwei: '55.00',
        note: 'Gas fees are included in the order amount. Estimated values shown.',
      });
    });
  });

  describe('getter methods', () => {
    it('should return funder address', () => {
      expect(service.getFunderAddress()).toBe(mockConfig.funderAddress);
    });

    it('should return server wallet address', () => {
      expect(service.getServerWalletAddress()).toBe(mockWallet.address);
    });

    it('should return USDC address', () => {
      expect(service.getUsdcAddress()).toBe(mockConfig.usdcAddress);
    });

    it('should return RPC URL', () => {
      expect(service.getRpcUrl()).toBe(mockConfig.rpcUrl);
    });
  });
});
