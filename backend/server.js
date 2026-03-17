const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const slotRoutes = require('./routes/slotRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const marksRoutes = require('./routes/marksRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const requestRoutes = require('./routes/requestRoutes');

const app = express();

// Connect to MongoDB
connectDB();

const parseBoolean = (value, fallback) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

const FRONTEND_URL = process.env.FRONTEND_URL || '';
const ALLOWED_ORIGINS = [
  FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5000'
].filter(Boolean);

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/marks', marksRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/document-requests', requestRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'research-lab-backend' });
});

// Serve static frontend only when explicitly enabled.
// In local development, serve frontend by default; keep production API-only unless explicitly enabled.
const shouldServeFrontend = parseBoolean(process.env.SERVE_FRONTEND, process.env.NODE_ENV !== 'production');
const publicPath = path.join(__dirname, '..', 'frontend', 'public');
if (shouldServeFrontend) {
  app.use(express.static(publicPath));
}
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

if (shouldServeFrontend) {
  app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      message: 'API server running',
      health: '/api/health'
    });
  });
}

// Error handler
app.use(errorHandler);

const BASE_PORT = Number(process.env.PORT || 5000);
const MAX_TRIES = 20;

function start(port, triesLeft) {
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE' && triesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} in use, trying ${nextPort}...`);
      return start(nextPort, triesLeft - 1);
    }
    console.error('Server error:', err);
    process.exit(1);
  });
}

start(BASE_PORT, MAX_TRIES);
