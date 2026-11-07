import hydrate from '@labpics/ui-astro/hydrate';
import { dev } from 'astro';

const server = await dev({
  root: new URL('.', import.meta.url),
  configFile: false,
  server: { host: '127.0.0.1', port: 0 },
  integrations: [hydrate()],
});
process.send({ port: server.address.port });
process.once('message', async () => {
  await server.stop();
  process.disconnect();
});
