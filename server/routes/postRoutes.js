import express from 'express';
import auth from '../middleware/auth.js';
import {
    getAllPosts,
    getPost,
    createPost,
    updatePost,
    deletePost,
    toggleLike,
    addComment,
    getPostsByUser,
    addReaction,
    trackPostView
} from '../controllers/postController.js';

const router = express.Router();

// Public routes
router.get('/', getAllPosts);

// Protected routes - require authentication
router.use(auth);

// IMPORTANT: Specific routes must come BEFORE parameterized routes
// This route must come before /:id to avoid conflicts
router.get('/user/:userId', getPostsByUser);

// General post routes
router.post('/', createPost);
router.get('/:id', getPost);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);
router.post('/:id/like', toggleLike);
router.post('/:id/comment', addComment);
router.post('/:id/react', addReaction);
router.post('/:id/view', trackPostView);

export default router; 