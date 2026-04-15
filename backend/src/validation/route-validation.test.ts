import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedRepositories = vi.hoisted(() => ({
  queuesRepository: {
    getAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    addPhones: vi.fn(),
    removePhone: vi.fn(),
    rename: vi.fn(),
    merge: vi.fn(),
  },
  leadFoldersRepository: {
    getAll: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    addLeads: vi.fn(),
    removeLeads: vi.fn(),
  },
}));

vi.mock('../modules/queues/queues.repository', () => ({ queuesRepository: mockedRepositories.queuesRepository }));
vi.mock('../modules/leads/lead-folders.repository', () => ({ leadFoldersRepository: mockedRepositories.leadFoldersRepository }));

import queuesRoutes from '../routes/queues.routes';
import leadFoldersRoutes from '../routes/lead-folders.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenantId = '11111111-1111-4111-8111-111111111111';
    next();
  });
  app.use('/queues', queuesRoutes);
  app.use('/lead-folders', leadFoldersRoutes);
  return app;
}

describe('route validation hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects queue merge with invalid identifiers', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/queues/merge')
      .send({ sourceIds: ['abc', 'def'], name: 'Fila unificada' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Identificador inválido');
    expect(mockedRepositories.queuesRepository.merge).not.toHaveBeenCalled();
  });

  it('rejects lead folder operations with invalid lead ids', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/lead-folders/11111111-1111-4111-8111-111111111111/leads')
      .send({ leadIds: ['bad-id'] });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Identificador inválido');
    expect(mockedRepositories.leadFoldersRepository.addLeads).not.toHaveBeenCalled();
  });

  it('passes sanitized queue creation payloads to the repository', async () => {
    const app = buildApp();
    mockedRepositories.queuesRepository.create.mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Fila limpa',
      phones: [],
      createdAt: new Date().toISOString(),
    });

    const response = await request(app)
      .post('/queues')
      .send({ name: '   Fila limpa   ' });

    expect(response.status).toBe(201);
    expect(mockedRepositories.queuesRepository.create).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({ name: 'Fila limpa' }),
    );
  });
});