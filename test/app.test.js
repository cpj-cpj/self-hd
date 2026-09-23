const request = require('supertest');
const app = require('../src/app');

describe('self-hd service', () => {
  test('returns service health', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('self-hd');
  });

  test('lists existing tasks', async () => {
    const response = await request(app).get('/api/tasks');

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  test('creates a task with validation', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Record demo video' });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      title: 'Record demo video',
      status: 'todo'
    });
  });

  test('rejects invalid task titles', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'x' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('at least 3 characters');
  });

  test('exposes Prometheus metrics', async () => {
    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.text).toContain('self_hd_http_requests_total');
  });
});

