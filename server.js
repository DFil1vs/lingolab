// Сервер: отдаёт страницу, стили, JavaScript и учебные материалы.
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const app = express();
const publicDirectory = fileURLToPath(new URL('./public/', import.meta.url));
const content = JSON.parse(readFileSync(new URL('./data/content.json', import.meta.url), 'utf8'));

app.disable('x-powered-by');
app.get('/api/content', (_request, response) => response.json(content));
app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
app.use(express.static(publicDirectory));
app.use((_request, response) => response.status(404).send('Page not found. Open http://localhost:3000'));

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`\nLingoLab is ready: http://localhost:${port}\nPress Ctrl+C to stop.\n`);
  });
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') console.error(`Port ${port} is busy. Stop the other server or set PORT to another number.`);
    else console.error(error.message);
    process.exitCode = 1;
  });
}
