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
    addReaction
} from '../controllers/postController.js';

const router = express.Router();

// Public routes
router.get('/', getAllPosts);

// Protected routes - require authentication
router.use(auth);

router.post('/', createPost);
router.get('/:id', getPost);
router.get('/user/:userId', getPostsByUser);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);
router.post('/:id/like', toggleLike);
router.post('/:id/comment', addComment);
router.post('/:id/react', addReaction);

export default router; 