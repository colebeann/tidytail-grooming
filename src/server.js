import { createApp } from './app.js';
import { config } from './config.js';
import { log } from './lib/logger.js';

const server = createApp().listen(config.port, () => {
  log.info('server_started', { port: config.port, env: config.env });
});

// Slow-client protection
server.headersTimeout = 15_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    log.info('shutting_down', { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
