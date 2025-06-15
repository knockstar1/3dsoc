import express from 'express';
import auth from '../middleware/auth.js';
import {
  getMessages,
  sendMessage,
  markAsRead
} from '../controllers/messageController.js';

const router = express.Router();

// All routes are protected
router.use(auth);

// Get messages between current user and another user
router.get('/:userId', getMessages);

// Send a message to another user
router.post('/', sendMessage);

// Mark messages as read
router.put('/:userId/read', markAsRead);

export default router; 