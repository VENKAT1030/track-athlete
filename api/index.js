require('dotenv').config();
const express = require('express');
const cors = require('cors');

const connectDB = require('../server/config/db');

const authRoutes = require('../server/routes/auth.routes');
const athleteRoutes = require('../server/routes/athlete.routes');
const parentRoutes = require('../server/routes/parent.routes');
const coachRoutes = require('../server/routes/coach.routes');
const academyRoutes = require('../server/routes/academy.routes');
const sponsorRoutes = require('../server/routes/sponsor.routes');
const tournamentRoutes = require('../server/routes/tournament.routes');
const referenceRoutes = require('../server/routes/reference.routes');
const chatRoutes = require('../server/routes/chat.routes');

const app = express();

// Whitelisted Origins for CORS
const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
  'https://track-athlete.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5000'
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  // Narrowly scope to TrackAthlete project Vercel preview domains ONLY (e.g. track-athlete-*.vercel.app)
  if (/^https:\/\/track-athlete-[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) return true;
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('Database Connection Error in Vercel Serverless Function:', err);
  }
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'TrackAthlete Serverless API' }));

app.use('/api/auth', authRoutes);
app.use('/api/athlete', athleteRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/academy', academyRoutes);
app.use('/api/sponsor', sponsorRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/chat', chatRoutes);

module.exports = app;
