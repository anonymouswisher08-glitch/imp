import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { MongoClient } from 'mongodb';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, /^(image|video|audio)\//.test(file.mimetype))
});

let db;
if (process.env.MONGODB_URI) {
  const client = new MongoClient(process.env.MONGODB_URI);
  client.connect().then(async () => {
    db = client.db();
    await Promise.all([
      collection('consented_analytics_events').createIndex({ createdAt: -1 }),
      collection('consented_analytics_events').createIndex({ sessionId: 1, createdAt: -1 }),
      collection('consented_analytics_events').createIndex({ event: 1, createdAt: -1 }),
      collection('consented_analytics_events').createIndex({ memory: 1, event: 1, createdAt: -1 })
    ]);
    console.log('Connected to MongoDB');
  })
    .catch((error) => console.error('MongoDB connection failed:', error.message));
}
const collection = (name) => db?.collection(name);
const clean = (value, max = 120) => String(value || '').trim().slice(0, max);
const analyticsEventNames = new Set(['consent_granted', 'visit_started', 'visit_ended', 'section_entered', 'section_left', 'memory_opened', 'memory_closed', 'media_opened', 'video_played', 'video_paused', 'video_ended', 'media_downloaded', 'download_started', 'name_revealed', 'expense_added']);
const cleanNumber = (value, max) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max ? Number(value) : undefined;
const databaseRequired = (res) => {
  if (db) return false;
  res.status(503).json({ message: 'MongoDB is not configured yet. Add MONGODB_URI to .env and restart.' });
  return true;
};
const requireAdmin = (req, res, next) => {
  if (!process.env.ADMIN_API_KEY || req.get('x-admin-key') !== process.env.ADMIN_API_KEY) return res.status(401).json({ message: 'Admin authorization is required.' });
  next();
};

app.get('/api/health', (_req, res) => res.json({ online: true, database: Boolean(db) }));
app.get('/api/expenses', async (_req, res) => {
  if (databaseRequired(res)) return;
  res.json(await collection('shared_expenses').find({}).sort({ spentOn: -1, createdAt: -1 }).toArray());
});
app.post('/api/expenses', async (req, res) => {
  if (databaseRequired(res)) return;
  const { title, category, amount, sharedWith, paidBy, note, spentOn } = req.body;
  if (!clean(title, 80) || !clean(category, 40) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ message: 'Please enter a title, category, and valid amount.' });
  const expense = { title: clean(title, 80), category: clean(category, 40), amount: Number(amount), sharedWith: clean(sharedWith || 'Us', 40), paidBy: clean(paidBy || 'Us', 40), note: clean(note, 240), spentOn: /^\d{4}-\d{2}-\d{2}$/.test(spentOn || '') ? spentOn : new Date().toISOString().slice(0, 10), createdAt: new Date() };
  const result = await collection('shared_expenses').insertOne(expense);
  res.status(201).json({ ...expense, _id: result.insertedId });
});

// Only anonymous, in-site actions are recorded. No IP, device ID, or browsing history is saved.
app.post('/api/events', async (req, res) => {
  if (databaseRequired(res)) return;
  const event = clean(req.body?.event, 40);
  if (!new Set(['page_opened', 'name_revealed', 'expense_added']).has(event)) return res.status(400).json({ message: 'Unknown event.' });
  await collection('site_events').insertOne({ event, eventId: crypto.randomUUID(), createdAt: new Date() });
  res.status(201).json({ recorded: true });
});

// Consent-only analytics. These records contain no IP address, device ID, location, or browser history.
app.post('/api/analytics/events', async (req, res) => {
  if (databaseRequired(res)) return;
  const event = clean(req.body?.event, 40);
  const sessionId = clean(req.body?.sessionId, 100);
  if (!analyticsEventNames.has(event) || !/^[A-Za-z0-9_-]{8,100}$/.test(sessionId)) return res.status(400).json({ message: 'Invalid analytics event.' });

  const deviceType = clean(req.body?.deviceType, 16);
  const analyticsEvent = {
    event,
    sessionId,
    deviceType: ['mobile', 'tablet', 'desktop'].includes(deviceType) ? deviceType : 'unknown',
    userAgent: clean(req.body?.userAgent, 512),
    screenWidth: cleanNumber(req.body?.screenWidth, 10000),
    screenHeight: cleanNumber(req.body?.screenHeight, 10000),
    section: clean(req.body?.section, 80),
    memory: clean(req.body?.memory, 24),
    media: clean(req.body?.media, 120),
    durationMs: cleanNumber(req.body?.durationMs, 24 * 60 * 60 * 1000),
    createdAt: new Date()
  };
  await collection('consented_analytics_events').insertOne(analyticsEvent);
  res.status(201).json({ recorded: true });
});

app.get('/api/content', async (_req, res) => {
  if (databaseRequired(res)) return;
  res.json(await collection('site_content').find({ public: true }).sort({ order: 1 }).toArray());
});
app.post('/api/content', requireAdmin, async (req, res) => {
  if (databaseRequired(res)) return;
  const { type, title, body, order = 0, public: isPublic = true } = req.body;
  if (!['memory', 'message', 'milestone'].includes(type) || !clean(title, 100)) return res.status(400).json({ message: 'A valid content type and title are required.' });
  const item = { type, title: clean(title, 100), body: clean(body, 600), order: Number(order) || 0, public: Boolean(isPublic), updatedAt: new Date() };
  const result = await collection('site_content').insertOne({ ...item, createdAt: new Date() });
  res.status(201).json({ ...item, _id: result.insertedId });
});
app.get('/api/memories/:memoryId/media', async (req, res) => {
  if (databaseRequired(res)) return;
  const media = await collection('memory_media').findOne({ memoryId: clean(req.params.memoryId, 4) }, { sort: { createdAt: -1 } });
  res.json(media || null);
});
app.post('/api/memories/:memoryId/media', upload.single('media'), async (req, res) => {
  if (databaseRequired(res)) return;
  if (!req.file) return res.status(400).json({ message: 'Choose an image, video, or audio file (up to 12 MB).' });
  const item = { memoryId: clean(req.params.memoryId, 4), filename: req.file.filename, originalName: clean(req.file.originalname, 120), mimeType: req.file.mimetype, url: `/uploads/${req.file.filename}`, createdAt: new Date() };
  await collection('memory_media').insertOne(item);
  res.status(201).json(item);
});
app.get('/api/dashboard', requireAdmin, async (_req, res) => {
  if (databaseRequired(res)) return;
  const [expenseStats, eventStats, recentExpenses] = await Promise.all([
    collection('shared_expenses').aggregate([{ $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]).toArray(),
    collection('site_events').aggregate([{ $group: { _id: '$event', count: { $sum: 1 } } }]).toArray(),
    collection('shared_expenses').find({}).sort({ createdAt: -1 }).limit(10).toArray()
  ]);
  res.json({ expenseStats, eventStats, recentExpenses });
});

app.get('/api/analytics/dashboard', requireAdmin, async (_req, res) => {
  if (databaseRequired(res)) return;
  const [eventsByType, devices, sections, memoryActivity, recentEvents] = await Promise.all([
    collection('consented_analytics_events').aggregate([{ $group: { _id: '$event', count: { $sum: 1 } } }, { $sort: { count: -1 } }]).toArray(),
    collection('consented_analytics_events').aggregate([{ $match: { event: 'visit_started' } }, { $group: { _id: '$deviceType', visits: { $sum: 1 } } }, { $sort: { visits: -1 } }]).toArray(),
    collection('consented_analytics_events').aggregate([{ $match: { event: 'section_left', durationMs: { $type: 'number' } } }, { $group: { _id: '$section', visits: { $sum: 1 }, totalDurationMs: { $sum: '$durationMs' } } }, { $sort: { totalDurationMs: -1 } }]).toArray(),
    collection('consented_analytics_events').aggregate([{ $match: { memory: { $ne: '' } } }, { $group: { _id: { memory: '$memory', event: '$event', media: '$media' }, count: { $sum: 1 }, totalDurationMs: { $sum: '$durationMs' } } }, { $sort: { '_id.memory': 1, '_id.event': 1 } }]).toArray(),
    collection('consented_analytics_events').find({}).sort({ createdAt: -1 }).limit(100).toArray()
  ]);
  res.json({ eventsByType, devices, sections, memoryActivity, recentEvents });
});

function startServer(candidatePort) {
  const server = app.listen(candidatePort, () => console.log(`The Reveal is running at http://localhost:${candidatePort}`));
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = Number(candidatePort) + 1;
      console.warn(`Port ${candidatePort} is busy; trying ${nextPort}...`);
      startServer(nextPort);
      return;
    }
    throw error;
  });
}
startServer(Number(port));
