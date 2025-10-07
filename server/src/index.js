import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeTrack } from './realtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const startServer = async () => {
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });

  const app = express();
  const upload = multer({
    dest: uploadsDir,
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      const mimetype = file.mimetype?.toLowerCase() ?? '';
      const isAudio = mimetype.startsWith('audio/');

      if (!isAudio) {
        req.fileValidationError =
          'Invalid file type. Please upload a supported audio format.';
        return cb(null, false);
      }

      cb(null, true);
    },
  });

  app.use(cors({ origin: CLIENT_ORIGIN }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/analyze', (req, res) => {
    upload.single('track')(req, res, async (err) => {
      if (err instanceof multer.MulterError) {
        const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({
          error: 'Upload failed',
          details: err.message,
        });
      }

      if (err) {
        console.error('Upload middleware failed', err);
        return res.status(500).json({
          error: 'Unexpected upload error',
          details: err.message ?? 'Unknown error',
        });
      }

      if (req.fileValidationError) {
        return res.status(400).json({
          error: 'Invalid track upload',
          details: req.fileValidationError,
        });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Missing track upload' });
      }

      const task = req.body.task || 'analysis';
      const lyricContext = req.body.lyricContext || '';

      const filePath = path.join(__dirname, '..', req.file.path);

      try {
        const audioBuffer = await fs.readFile(filePath);

        const result = await analyzeTrack({
          task,
          audioBuffer,
          lyricContext,
        });

        res.json(result);
      } catch (error) {
        console.error('Realtime analysis failed', error);
        res.status(500).json({
          error: 'Failed to process track with OpenAI Realtime API',
          details: error?.message ?? 'Unknown error',
        });
      } finally {
        await fs.unlink(filePath).catch(() => {});
      }
    });
  });

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
};

startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
