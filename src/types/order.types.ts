export type OrderJobData = {
  orderId: number;
  attempt: number;
};

export type OrderExecutionResult = {
  success: boolean;
  fillPrice?: string;
  externalOrderId?: string;
  reason?: string;
};
