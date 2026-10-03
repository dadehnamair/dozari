import { ContentApi } from './api.js';
import { buildLanding } from './server.js';

const port = Number(process.env.PORT ?? 3100);
const apiUrl = (process.env.API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const app = buildLanding({ api: new ContentApi(apiUrl), siteUrl: process.env.SITE_URL });

app.listen({ port, host: '0.0.0.0' }).then(
  () => console.log(`landing on :${port}, content from ${apiUrl}`),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
