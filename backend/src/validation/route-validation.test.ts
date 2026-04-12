import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedRepositories = vi.hoisted(() => ({
  scheduleRepository: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  productivityRepository: {
    getAll: vi.fn(),
    getById: vi.fn(),
    getByWeek: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
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

vi.mock('../modules/schedule/schedule.repository', () => ({ scheduleRepository: mockedRepositories.scheduleRepository }));
vi.mock('../modules/productivity/productivity.repository', () => ({ productivityRepository: mockedRepositories.productivityRepository }));
vi.mock('../modules/queues/queues.repository', () => ({ queuesRepository: mockedRepositories.queuesRepository }));
vi.mock('../modules/leads/lead-folders.repository', () => ({ leadFoldersRepository: mockedRepositories.leadFoldersRepository }));

import scheduleRoutes from '../routes/schedule.routes';
import productivityRoutes from '../routes/productivity.routes';
import queuesRoutes from '../routes/queues.routes';
import leadFoldersRoutes from '../routes/lead-folders.routes';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenantId = '11111111-1111-4111-8111-111111111111';
    next();
  });
  app.use('/schedule', scheduleRoutes);
  app.use('/productivity', productivityRoutes);
  app.use('/queues', queuesRoutes);
  app.use('/lead-folders', leadFoldersRoutes);
  return app;
}

describe('route validation hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid schedule creation payloads', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/schedule')
      .send({ title: 'Agenda', category: 'prottocode', startTime: '09:00', endTime: '10:00' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Informe date');
    expect(mockedRepositories.scheduleRepository.create).not.toHaveBeenCalled();
  });

  it('rejects empty productivity updates', async () => {
    const app = buildApp();
    const response = await request(app)
      .patch('/productivity/11111111-1111-4111-8111-111111111111')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Nenhum campo');
    expect(mockedRepositories.productivityRepository.update).not.toHaveBeenCalled();
  });

  it('rejects invalid productivity week params', async () => {
    const app = buildApp();
    const response = await request(app).get('/productivity/week/not-a-week');

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Semana inválida');
    expect(mockedRepositories.productivityRepository.getByWeek).not.toHaveBeenCalled();
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