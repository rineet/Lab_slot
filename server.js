const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./backend/config/db');
const errorHandler = require('./backend/middleware/errorHandler');

// Route imports
const authRoutes = require('./backend/routes/authRoutes');
const resourceRoutes = require('./backend/routes/resourceRoutes');
const slotRoutes = require('./backend/routes/slotRoutes');
const adminRoutes = require('./backend/routes/adminRoutes');
const userRoutes = require('./backend/routes/userRoutes');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);

// Serve static frontend
const publicPath = path.join(__dirname, 'frontend', 'public');
app.use(express.static(publicPath));

// Fallback to index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

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

