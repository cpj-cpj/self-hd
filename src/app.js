const express = require('express');
const helmet = require('helmet');
const client = require('prom-client');

const app = express();
const tasks = [
  {
    id: 1,
    title: 'Create Jenkins pipeline',
    status: 'done'
  },
  {
    id: 2,
    title: 'Deploy with Docker',
    status: 'in-progress'
  }
];

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const httpRequestCounter = new client.Counter({
  name: 'self_hd_http_requests_total',
  help: 'Total number of HTTP requests handled by the service',
  labelNames: ['method', 'route', 'status']
});
registry.registerMetric(httpRequestCounter);

app.use(helmet());
app.use(express.json());

app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status: String(res.statusCode)
    });
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'self-hd',
    version: process.env.APP_VERSION || 'dev',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/tasks', (req, res) => {
  res.json({ data: tasks });
});

app.post('/api/tasks', (req, res) => {
  const title = String(req.body.title || '').trim();

  if (title.length < 3) {
    return res.status(400).json({
      error: 'Task title must be at least 3 characters long.'
    });
  }

  const task = {
    id: tasks.length + 1,
    title,
    status: 'todo'
  };
  tasks.push(task);

  return res.status(201).json({ data: task });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

module.exports = app;

