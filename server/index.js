import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { MongoClient, ServerApiVersion } from 'mongodb';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 