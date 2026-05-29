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
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag');
      res.setHeader('Accept-Ranges', 'bytes');

      // Byte-range support for PMTiles which fetches headers + leaf directories.
      const range = req.headers.range;
      const size = stat.size;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (match) {
          const start = match[1] === '' ? 0 : Number(match[1]);
          const end = match[2] === '' ? size - 1 : Number(match[2]);
          if (start <= end && end < size) {
            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
            res.setHeader('Content-Length', String(end - start + 1));
            fs.createReadStream(filePath, { start, end }).pipe(res);
            return;
          }
          res.statusCode = 416;
          res.setHeader('Content-Range', `bytes */${size}`);
          res.end();
          return;
        }
      }
      res.setHeader('Content-Length', String(size));
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
      '@plateau/r3f': path.resolve(__dirname, '../../src/index.ts'),
    },
    dedupe: ['three', 'react', 'react-dom', '@react-three/fiber'],
  },
});
