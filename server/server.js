import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();

// Middleware (now after static file serving)
app.use(express.json());
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite default port
    'http://localhost:3000',  // React default port
    'http://localhost:5000'   // Backend port
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Ensure required environment variables are set with fallbacks
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3d-social';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const PORT = process.env.PORT || 5000;

console.log('Starting server with configuration:');
console.log('- Node Environment:', process.env.NODE_ENV || 'development');
console.log('- Port:', PORT);
console.log('- MongoDB URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials
console.log('- JWT Secret:', JWT_SECRET ? '[SET]' : '[NOT SET]');

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if can't connect to database
  });

// Routes with error handling
try {
  console.log('Mounting API routes...');
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/notifications', notificationRoutes);
  console.log('API routes mounted successfully');
} catch (error) {
  console.error('Error mounting routes:', error);
  process.exit(1);
}

// Serve static files in production (MOVED HERE - after API routes)
if (process.env.NODE_ENV === 'production') {
  const pathToDist = path.resolve(__dirname, '..', 'dist');
  console.log(`Render Path to dist: ${pathToDist}`);
  app.use(express.static(pathToDist)); // Serve static assets

  // Catch-all for client-side routing (serves index.html for all unmatched routes)
  app.get('*', (req, res) => {
    console.log(`Catch-all for frontend hit: ${req.url}`);
    res.sendFile(path.join(pathToDist, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error handler caught:', err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 