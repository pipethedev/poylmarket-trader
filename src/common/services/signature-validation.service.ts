import { Injectable } from '@nestjs/common';
import { verifyMessage } from '@ethersproject/wallet';
import { AppLogger, LogPrefix } from '@common/logger/index';

@Injectable()
export class SignatureValidationService {
  private readonly logger: AppLogger;

  constructor(logger: AppLogger) {
    this.logger = logger.setPrefix(LogPrefix.API).setContext(SignatureValidationService.name);
  }

  verifyMessage(message: string, signature: string, expectedAddress: string): boolean {
    try {
      const recoveredAddress = verifyMessage(message, signature);
      const isValid = recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();

      if (!isValid) {
        this.logger.warn(`Signature validation failed: recovered ${recoveredAddress}, expected ${expectedAddress}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Error verifying signature: ${(error as Error).message}`);
      return false;
    }
  }
}
