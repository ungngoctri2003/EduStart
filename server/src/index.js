import 'dotenv/config';
import app from './app.js';
import { closeCertificateBrowser } from './lib/certificatePdf.js';

const port = Number(process.env.PORT) || 4000;

async function shutdown() {
  await closeCertificateBrowser().catch(() => {});
  process.exit(0);
}

process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
