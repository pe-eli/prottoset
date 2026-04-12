import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/resend.service', () => ({
  resendService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../services/deepseek.service', () => ({
  deepseekService: {
    generateWhatsAppMessage: vi.fn().mockResolvedValue('Olá, tudo bem?'),
  },
}));

vi.mock('../../services/evolution.service', () => ({
  evolutionService: {
    checkNumbers: vi.fn().mockResolvedValue({ valid: ['5511999999999'], invalid: [] }),
    fetchExistingChats: vi.fn().mockResolvedValue(new Set()),
    sendMessage: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import { blastQueue } from './blast.queue';
import { waBlastQueue } from '../whatsapp/whatsapp.queue';

function createMockResponse() {
  return {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    on: vi.fn(),
  } as any;
}

describe('blast queue tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hides email blast entries from other tenants', () => {
    blastQueue.create('tenant-a', '11111111-1111-4111-8111-111111111111', ['a@example.com'], 'subject', 'body', {
      batchSize: 1,
      intervalMinSeconds: 5,
      intervalMaxSeconds: 5,
    });

    expect(blastQueue.get('tenant-a', '11111111-1111-4111-8111-111111111111')).toBeDefined();
    expect(blastQueue.get('tenant-b', '11111111-1111-4111-8111-111111111111')).toBeUndefined();
    expect(blastQueue.subscribe('tenant-b', '11111111-1111-4111-8111-111111111111', createMockResponse())).toBe(false);
  });

  it('blocks whatsapp blast access across tenants', () => {
    waBlastQueue.create('tenant-a', '22222222-2222-4222-8222-222222222222', ['11999999999'], {
      batchSize: 1,
      intervalMinSeconds: 5,
      intervalMaxSeconds: 5,
      promptBase: 'teste',
    });

    expect(waBlastQueue.get('tenant-a', '22222222-2222-4222-8222-222222222222')).toBeDefined();
    expect(waBlastQueue.get('tenant-b', '22222222-2222-4222-8222-222222222222')).toBeUndefined();
    expect(waBlastQueue.status('tenant-b', '22222222-2222-4222-8222-222222222222')).toBeNull();
    expect(waBlastQueue.cancel('tenant-b', '22222222-2222-4222-8222-222222222222')).toBe(false);
    expect(waBlastQueue.subscribe('tenant-b', '22222222-2222-4222-8222-222222222222', createMockResponse())).toBe(false);
  });
});