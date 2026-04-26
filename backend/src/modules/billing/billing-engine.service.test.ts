import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreditTransaction } from './credit-ledger.repository';

vi.mock('../../infrastructure/distributed-lock', () => ({
  withDistributedLock: vi.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('./credit-ledger.repository', () => ({
  creditLedgerRepository: {
    getByIdempotencyKey: vi.fn(),
    createPending: vi.fn(),
    markFailed: vi.fn(),
    getById: vi.fn(),
    markCommitted: vi.fn(),
    markRefunded: vi.fn(),
  },
}));

vi.mock('./usage-tracker.service', () => ({
  usageTrackerService: {
    checkFeatureLimit: vi.fn(),
    reserveMonthlyUsage: vi.fn(),
    refundMonthlyUsage: vi.fn(),
  },
}));

vi.mock('../../observability/audit-log.service', () => ({
  auditLogService: {
    record: vi.fn(async () => {}),
  },
}));

vi.mock('../../observability/metrics.service', () => ({
  metricsService: {
    increment: vi.fn(),
  },
}));

vi.mock('../../observability/structured-logger', () => ({
  structuredLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    event: vi.fn(),
  },
}));

import { billingEngine } from './billing-engine.service';
import { creditLedgerRepository } from './credit-ledger.repository';
import { usageTrackerService } from './usage-tracker.service';

function makeTransaction(status: CreditTransaction['status']): CreditTransaction {
  return {
    id: 'tx-1',
    tenantId: 'tenant-1',
    feature: 'emails',
    amount: 1,
    status,
    idempotencyKey: 'idem-key-1234',
    metadata: {},
    failureReason: null,
    createdAt: new Date().toISOString(),
    committedAt: status === 'COMMITTED' ? new Date().toISOString() : null,
    refundedAt: status === 'REFUNDED' ? new Date().toISOString() : null,
  };
}

describe('billingEngine idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns idempotent replay for already committed consumeImmediate', async () => {
    vi.mocked(creditLedgerRepository.getByIdempotencyKey).mockResolvedValue(makeTransaction('COMMITTED'));

    const result = await billingEngine.consumeImmediate({
      tenantId: 'tenant-1',
      feature: 'emails',
      amount: 1,
      idempotencyKey: 'idem-key-1234',
    });

    expect(result.consumed).toBe(true);
    expect(result.idempotentReplay).toBe(true);
    expect(result.transactionId).toBe('tx-1');
    expect(creditLedgerRepository.createPending).not.toHaveBeenCalled();
    expect(usageTrackerService.reserveMonthlyUsage).not.toHaveBeenCalled();
  });

  it('commit is idempotent when transaction is already committed', async () => {
    vi.mocked(creditLedgerRepository.getById).mockResolvedValue(makeTransaction('COMMITTED'));

    const result = await billingEngine.commit('tenant-1', 'tx-1');

    expect(result).toEqual({ ok: true, idempotentReplay: true });
    expect(creditLedgerRepository.markCommitted).not.toHaveBeenCalled();
  });

  it('refund is idempotent when transaction is already refunded', async () => {
    vi.mocked(creditLedgerRepository.getById).mockResolvedValue(makeTransaction('REFUNDED'));

    const result = await billingEngine.refund('tenant-1', 'tx-1', 'duplicate_call');

    expect(result).toEqual({ ok: true, idempotentReplay: true });
    expect(creditLedgerRepository.markRefunded).not.toHaveBeenCalled();
    expect(usageTrackerService.refundMonthlyUsage).not.toHaveBeenCalled();
  });
});
