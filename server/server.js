import dotenv from 'dotenv';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ServerApiVersion } from 'mongodb';

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// Serve static files from Vite's build output directory (dist)
app.use(express.static(path.join(__dirname, '../dist')));

// Serve static files from the public directory (for fonts, models, favicon)
app.use(express.static(path.join(__dirname, '../public')));

// Middleware
app.use(express.json());
app.use(cors({
  origin: [
    'https://iw-9wja.onrender.com',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Health Check Endpoint
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// --- MongoDB Connection Test using MongoClient (for explicit ping confirmation) ---
const uri = process.env.MONGODB_URI;

if (uri) {
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  async function runClientTest() {
    try {
      console.log(`Attempting MongoClient test connection to: ${uri ? uri.split('@')[1] : 'undefined URI'}`);
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } catch (error) {
      console.error('MongoClient test connection error:', error);
    } finally {
      await client.close();
    }
  }
  runClientTest().catch(console.dir);
} else {
  console.warn('MONGODB_URI environment variable is not set for MongoClient test connection. Falling back to default Mongoose connection.');
}
// --- End of MongoDB Connection Test ---

// Connect to MongoDB using Mongoose
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/3d-social';
console.log(`Mongoose attempting to connect to: ${mongoUri}`);
mongoose.connect(mongoUri)
  .then(() => console.log('Mongoose connected to MongoDB'))
  .catch(err => console.error('Mongoose connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);

// Serve index.html for the root route as a fallback
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 