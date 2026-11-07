import { config } from './config.js';
import { Engine } from './engine.js';
import { Poller } from './poller.js';
import { createServer } from './http.js';

const engine = new Engine();
const poller = new Poller(engine);
const server = createServer(engine, poller);

server.listen(config.port, '0.0.0.0', () => {
  const mode = engine.source === 'demo' ? 'DEMO' : 'LIVE';
  console.log('');
  console.log(`  Brawl Ranked Overlay  ·  ${mode}`);
  console.log(`  Overlay  http://localhost:${config.port}/overlay`);
  console.log(`  Control  http://localhost:${config.port}/control`);
  if (!config.token && engine.source === 'live') {
    console.log('  ! No BRAWL_API_TOKEN in .env — set it, or run with DEMO=1');
  } else if (config.playerTag) {
    console.log(`  Player   ${config.playerTag}  ·  poll ${Math.round(config.pollMs / 1000)}s`);
  }
  console.log('');
});

poller.start();

function shutdown() {
  poller.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);