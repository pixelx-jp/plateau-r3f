import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { type Connect } from 'vite';

const PLATEAU_CORE = path.resolve(__dirname, '../../../plateau-core');

function plateauDataMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? '';
    if (!url.startsWith('/plateau-data/')) return next();
    // /plateau-data/<city>/<file...> -> <PLATEAU_CORE>/out_<city>/<file>
    // Strip query string before splitting.
    const noQuery = url.split('?')[0];
    const rest = noQuery.slice('/plateau-data/'.length);
    const [city, ...parts] = rest.split('/');
    // Keep segments verbatim — plateau-core writes encoded filenames literally
    // (e.g. "15%2F29102%2F4943_bldg_Building.glb.arrow") to disk.
    const filePath = path.resolve(PLATEAU_CORE, `out_${city}`, parts.join('/'));
    if (!filePath.startsWith(PLATEAU_CORE)) {
      res.statusCode = 403;
      res.end('forbidden');
      return;
    }
    fs.stat(filePath, (err, stat) => {
      if (err || !stat.isFile()) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const mime =
        ext === '.json'
          ? 'application/json'
          : ext === '.arrow'
          ? 'application/vnd.apache.arrow.file'
          : ext === '.glb'
          ? 'model/gltf-binary'
          : ext === '.pmtiles'
          ? 'application/octet-stream'
          : 'application/octet-stream';
      res.setHeader('Content-Type', mime);
      res.setHeader('Access-Control-Allow-Origin', '*');
      fs.createReadStream(filePath).pipe(res);
    });
  };
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'plateau-data',
      configureServer(server) {
        server.middlewares.use(plateauDataMiddleware());
      },
    },
  ],
  resolve: {
    alias: {
      '@yodolabs/plateau-r3f': path.resolve(__dirname, '../../src/index.ts'),
    },
    dedupe: ['three', 'react', 'react-dom'],
  },
});
