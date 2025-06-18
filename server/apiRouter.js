import express from 'express';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import messageRoutes from './routes/messageRoutes.js';

const apiRouter = express.Router();

// Mount routes
apiRouter.use('/users', userRoutes);
apiRouter.use('/posts', postRoutes);
apiRouter.use('/messages', messageRoutes);

export default apiRouter; 