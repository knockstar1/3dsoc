import express from 'express';
import auth from '../middleware/auth.js';
import {
    getNotifications,
    markNotificationAsRead,
    deleteNotification
} from '../controllers/notificationController.js';

const router = express.Router();

// Protected routes
router.get('/', auth, getNotifications);
router.put('/:id/read', auth, markNotificationAsRead);
router.delete('/:id', auth, deleteNotification);

export default router; 