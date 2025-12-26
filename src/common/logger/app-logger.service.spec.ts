import { AppLogger, LogPrefix } from './app-logger.service';

describe('AppLogger', () => {
  let logger: AppLogger;

  beforeEach(() => {
    logger = new AppLogger();
  });

  describe('setPrefix', () => {
    it('should set the prefix and return this', () => {
      const result = logger.setPrefix(LogPrefix.API);
      expect(result).toBe(logger);
    });
  });

  describe('setContext', () => {
    it('should set the context and return this', () => {
      const result = logger.setContext('TestContext');
      expect(result).toBe(logger);
    });
  });

  describe('setContextData', () => {
    it('should set context data and return this', () => {
      const result = logger.setContextData({ userId: 1, action: 'test' });
      expect(result).toBe(logger);
    });
  });

  describe('child', () => {
    it('should create a child logger with merged context', () => {
      logger.setPrefix(LogPrefix.SYNC);
      logger.setContext('ParentContext');
      logger.setContextData({ parentKey: 'parentValue' });

      const child = logger.child({ childKey: 'childValue' });

      expect(child).toBeInstanceOf(AppLogger);
      expect(child).not.toBe(logger);
    });
  });

  describe('log', () => {
    it('should not throw when logging message with prefix and context', () => {
      logger.setPrefix(LogPrefix.ORDER);
      logger.setContext('OrderService');
      logger.setContextData({ orderId: 123 });

      expect(() => logger.log('Test message')).not.toThrow();
    });
  });

  describe('warn', () => {
    it('should not throw when logging warning message', () => {
      logger.setPrefix(LogPrefix.QUEUE);
      expect(() => logger.warn('Warning message')).not.toThrow();
    });
  });

  describe('error', () => {
    it('should not throw when logging error message', () => {
      logger.setPrefix(LogPrefix.PROVIDER);
      expect(() => logger.error('Error message', 'stack trace')).not.toThrow();
    });
  });

  describe('debug', () => {
    it('should not throw when logging debug message', () => {
      logger.setPrefix(LogPrefix.SCHEDULER);
      expect(() => logger.debug('Debug message')).not.toThrow();
    });
  });
});
