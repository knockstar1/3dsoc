import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function startServer() {
  const app = express();

  // Ensure required environment variables are set with fallbacks
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/3d-social';
  const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  const PORT = process.env.PORT || 5000;

  console.log('Starting server with configuration:');
  console.log('- Node Environment:', process.env.NODE_ENV || 'development');
  console.log('- Port:', PORT);
  console.log('- MongoDB URI:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
  console.log('- JWT Secret:', JWT_SECRET ? '[SET]' : '[NOT SET]');

  // Basic middleware only
  app.use(express.json({ limit: '10mb' }));

  // Simple CORS
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

  // Connect to MongoDB
  console.log('Connecting to MongoDB...');
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }

  // Health check route
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Import and mount routes one by one with error handling
  console.log('Importing routes...');

  try {
    console.log('Importing authRoutes...');
    const authRoutes = (await import('./routes/authRoutes.js')).default;
    console.log('Mounting /api/auth...');
    app.use('/api/auth', authRoutes);
    console.log('✓ /api/auth mounted');
  } catch (error) {
    console.error('Error with authRoutes:', error);
    process.exit(1);
  }

  try {
    console.log('Importing userRoutes...');
    const userRoutes = (await import('./routes/userRoutes.js')).default;
    console.log('Mounting /api/users...');
    app.use('/api/users', userRoutes);
    console.log('✓ /api/users mounted');
  } catch (error) {
    console.error('Error with userRoutes:', error);
    process.exit(1);
  }

  try {
    console.log('Importing postRoutes...');
    const postRoutes = (await import('./routes/postRoutes.js')).default;
    console.log('Mounting /api/posts...');
    app.use('/api/posts', postRoutes);
    console.log('✓ /api/posts mounted');
  } catch (error) {
    console.error('Error with postRoutes:', error);
    process.exit(1);
  }

  try {
    console.log('Importing messageRoutes...');
    const messageRoutes = (await import('./routes/messageRoutes.js')).default;
    console.log('Mounting /api/messages...');
    app.use('/api/messages', messageRoutes);
    console.log('✓ /api/messages mounted');
  } catch (error) {
    console.error('Error with messageRoutes:', error);
    process.exit(1);
  }

  try {
    console.log('Importing notificationRoutes...');
    const notificationRoutes = (await import('./routes/notificationRoutes.js')).default;
    console.log('Mounting /api/notifications...');
    app.use('/api/notifications', notificationRoutes);
    console.log('✓ /api/notifications mounted');
  } catch (error) {
    console.error('Error with notificationRoutes:', error);
    process.exit(1);
  }

  console.log('All API routes mounted successfully');

  // Static file serving and frontend routes
  if (process.env.NODE_ENV === 'production') {
    const pathToDist = path.resolve(__dirname, '..', 'dist');
    console.log(`Setting up static files from: ${pathToDist}`);
    
    try {
      // Serve static files
      app.use(express.static(pathToDist));
      console.log('✓ Static files middleware added');
      
      // Handle specific frontend routes
      app.get('/', (req, res) => {
        try {
          const indexPath = path.join(pathToDist, 'index.html');
          console.log('Serving index.html for home route');
          res.sendFile(indexPath);
        } catch (error) {
          console.error('Error serving index.html:', error);
          res.status(500).send('Error loading page');
        }
      });
      
      app.get('/character.html', (req, res) => {
        try {
          const characterPath = path.join(pathToDist, 'character.html');
          console.log('Serving character.html');
          res.sendFile(characterPath);
        } catch (error) {
          console.error('Error serving character.html:', error);
          res.status(500).send('Error loading page');
        }
      });
      
      app.get('/messages.html', (req, res) => {
        try {
          const messagesPath = path.join(pathToDist, 'messages.html');
          console.log('Serving messages.html');
          res.sendFile(messagesPath);
        } catch (error) {
          console.error('Error serving messages.html:', error);
          res.status(500).send('Error loading page');
        }
      });
      
      app.get('/notifications.html', (req, res) => {
        try {
          const notificationsPath = path.join(pathToDist, 'notifications.html');
          console.log('Serving notifications.html');
          res.sendFile(notificationsPath);
        } catch (error) {
          console.error('Error serving notifications.html:', error);
          res.status(500).send('Error loading page');
        }
      });
      
      console.log('✓ Frontend routes added');
      
    } catch (error) {
      console.error('Error setting up static files:', error);
      process.exit(1);
    }
  }

  // Basic error handler
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ message: 'Server error' });
  });

  // 404 handler for any unmatched routes
  app.use((req, res) => {
    console.log('404 - Route not found:', req.path);
    res.status(404).json({ message: 'Route not found' });
  });

  // Start server
  console.log('Starting server...');
  app.listen(PORT, () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('✓ Server startup complete');
  });
}

// Start the server
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
}); 