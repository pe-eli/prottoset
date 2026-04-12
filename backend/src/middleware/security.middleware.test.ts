import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { requireTrustedOrigin } from './security.middleware';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(requireTrustedOrigin(['http://localhost:5173']));
  app.get('/probe', (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/probe', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('requireTrustedOrigin', () => {
  it('allows safe methods without browser headers', async () => {
    const app = buildApp();
    const response = await request(app).get('/probe');
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('blocks mutable requests without X-Requested-With', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/probe')
      .set('Origin', 'http://localhost:5173')
      .send({ ok: true });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('política de segurança');
  });

  it('blocks mutable requests from non-allowed origins', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/probe')
      .set('Origin', 'https://evil.example')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ ok: true });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Origem não permitida');
  });

  it('allows mutable requests from allowed origins with browser header', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/probe')
      .set('Origin', 'http://localhost:5173')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ ok: true });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });
});