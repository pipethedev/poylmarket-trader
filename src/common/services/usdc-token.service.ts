import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract } from 'ethers';
import { Wallet } from '@ethersproject/wallet';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { getAddress } from '@ethersproject/address';

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
] as const;

@Injectable()
export class UsdcTokenService {
  private readonly logger = new Logger(UsdcTokenService.name);
  private readonly provider: StaticJsonRpcProvider;
  private readonly serverWallet: Wallet;
  private readonly funderAddress: string;
  private readonly usdcAddress: string;
  private readonly usdcContract: Contract;
  private readonly rpcUrl: string;

  constructor(private readonly configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('polymarket.rpcUrl');
    if (!rpcUrl) {
      throw new Error('POLYMARKET_RPC_URL is required for USDC operations');
    }

    const privateKey = this.configService.get<string>('polymarket.walletPrivateKey');
    if (!privateKey) {
      throw new Error('POLYMARKET_WALLET_PRIVATE_KEY is required for USDC operations');
    }

    this.funderAddress = this.configService.get<string>('polymarket.funderAddress')!;

    if (!this.funderAddress) {
      throw new Error('POLYMARKET_FUNDER_ADDRESS is required for USDC operations');
    }

    this.usdcAddress =
      this.configService.get<string>('polymarket.usdcAddress') ||
      '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

    this.rpcUrl = rpcUrl;

    this.provider = new StaticJsonRpcProvider(rpcUrl, {
      name: 'matic',
      chainId: 137,
    });
    this.serverWallet = new Wallet(privateKey, this.provider);
    this.usdcContract = new Contract(this.usdcAddress, ERC20_ABI, this.provider);

    this.logger.log(
      `USDC Token Service initialized. Funder address: ${this.funderAddress}, USDC address: ${this.usdcAddress}, RPC: ${rpcUrl}, Network: Polygon (137)`,
    );
  }

  async getBalance(address: string): Promise<string> {
    try {
      const checksumAddress = getAddress(address);
      const balance = await this.usdcContract.balanceOf(checksumAddress);
      const decimals = await this.usdcContract.decimals();
      const balanceFormatted = (Number(balance) / 10 ** decimals).toString();
      return balanceFormatted;
    } catch (error) {
      this.logger.error(`Failed to get USDC balance for ${address}: ${(error as Error).message}`);
      throw error;
    }
  }

  async getAllowance(userAddress: string): Promise<string> {
    try {
      const allowance = await this.usdcContract.allowance(userAddress, this.serverWallet.address);
      const decimals = await this.usdcContract.decimals();
      return (Number(allowance) / 10 ** decimals).toString();
    } catch (error) {
      this.logger.error(
        `Failed to get USDC allowance for ${userAddress}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getServerWalletMaticBalance(): Promise<string> {
    try {
      const balance = await this.provider.getBalance(this.serverWallet.address);

      const balanceFormatted = (Number(balance) / 10 ** 18).toString();

      this.logger.debug(
        `Server wallet MATIC balance: ${balanceFormatted} MATIC (${balance.toString()} wei)`,
      );
      return balanceFormatted;
    } catch (error) {
      this.logger.error(`Failed to get server wallet MATIC balance: ${(error as Error).message}`);
      throw error;
    }
  }

  private async getGasPrices(): Promise<{
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  }> {
    const feeData = await this.provider.getFeeData();

    const minPriorityFee = BigInt('25000000000');
    const minBaseFee = BigInt('30000000000');

    const networkPriorityFee = feeData.maxPriorityFeePerGas
      ? BigInt(feeData.maxPriorityFeePerGas.toString())
      : null;
    const networkBaseFee = feeData.maxFeePerGas ? BigInt(feeData.maxFeePerGas.toString()) : null;

    const maxPriorityFeePerGas =
      networkPriorityFee && networkPriorityFee > minPriorityFee
        ? networkPriorityFee
        : minPriorityFee;

    const maxFeePerGas =
      networkBaseFee && networkBaseFee > minBaseFee
        ? networkBaseFee
        : maxPriorityFeePerGas + minBaseFee;

    return {
      maxFeePerGas,
      maxPriorityFeePerGas,
    };
  }

  async transferFromUser(userAddress: string, amount: string): Promise<string> {
    try {
      const maticBalance = await this.getServerWalletMaticBalance();

      const minMaticRequired = 0.01;

      if (parseFloat(maticBalance) < minMaticRequired) {
        throw new Error(
          `Server wallet has insufficient MATIC for gas fees. Current balance: ${maticBalance} MATIC. Please fund the server wallet address: ${this.serverWallet.address}`,
        );
      }

      const decimals = await this.usdcContract.decimals();
      const amountWei = BigInt(Math.floor(parseFloat(amount) * 10 ** decimals));

      const allowance = await this.usdcContract.allowance(userAddress, this.serverWallet.address);
      if (allowance < amountWei) {
        throw new Error(
          `Insufficient allowance. User has approved ${allowance.toString()}, but need ${amountWei.toString()}`,
        );
      }

      const { maxFeePerGas, maxPriorityFeePerGas } = await this.getGasPrices();

      const contractWithSigner = this.usdcContract.connect(this.serverWallet);
      const tx = await contractWithSigner.transferFrom(userAddress, this.funderAddress, amountWei, {
        maxFeePerGas,
        maxPriorityFeePerGas,
      });

      this.logger.log(
        `Transferring ${amount} USDC from ${userAddress} to ${this.funderAddress}. Tx: ${tx.hash}`,
      );

      const receipt = await tx.wait();
      this.logger.log(`Transfer completed. Block: ${receipt.blockNumber}`);

      return tx.hash;
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(`Failed to transfer USDC from ${userAddress}: ${errorMessage}`);

      if (
        errorMessage.includes('insufficient funds') ||
        errorMessage.includes('INSUFFICIENT_FUNDS')
      ) {
        throw new Error(
          `Server wallet has insufficient MATIC for gas fees. Please fund the server wallet address ${this.serverWallet.address} with MATIC (Polygon's native token) to pay for transaction gas fees.`,
        );
      }

      throw error;
    }
  }

  getFunderAddress(): string {
    return this.funderAddress;
  }

  getServerWalletAddress(): string {
    return this.serverWallet.address;
  }

  getUsdcAddress(): string {
    return this.usdcAddress;
  }

  getRpcUrl(): string {
    return this.rpcUrl;
  }

  async estimateGasFees(): Promise<{
    estimatedGasMatic: string;
    estimatedGasUsd: string;
    gasPriceGwei: string;
    note: string;
  }> {
    try {
      const { maxFeePerGas } = await this.getGasPrices();

      const estimatedGasLimit = BigInt('65000');
      const estimatedTotalGas = maxFeePerGas * estimatedGasLimit;

      const estimatedGasMatic = (Number(estimatedTotalGas) / 10 ** 18).toFixed(6);

      const maticPriceUsd = 0.1;
      const estimatedGasUsd = (parseFloat(estimatedGasMatic) * maticPriceUsd).toFixed(4);

      const gasPriceGwei = (Number(maxFeePerGas) / 10 ** 9).toFixed(2);

      return {
        estimatedGasMatic,
        estimatedGasUsd,
        gasPriceGwei,
        note: 'Gas fees are included in the order amount. This is an estimate.',
      };
    } catch (error) {
      this.logger.error(`Failed to estimate gas fees: ${(error as Error).message}`);
      return {
        estimatedGasMatic: '0.003',
        estimatedGasUsd: '0.0003',
        gasPriceGwei: '55.00',
        note: 'Gas fees are included in the order amount. Estimated values shown.',
      };
    }
  }
}
