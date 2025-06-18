import Post from '../models/Post.js';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';

// Get all posts with pagination
export const getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username')
      .populate('comments.user', 'username');

    const total = await Post.countDocuments();

    res.status(200).json({
      success: true,
      data: posts,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching posts',
      error: error.message
    });
  }
};

// Get single post by ID
export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'username')
      .populate('comments.user', 'username');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    res.status(200).json({
      success: true,
      data: post
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching post',
      error: error.message
    });
  }
};

// Create new post
export const createPost = async (req, res) => {
  try {
    const { content, characterConfig, position } = req.body;
    
    // Create post in MongoDB
    const post = await Post.create({
      content,
      characterConfig,
      position,
      author: req.user._id
    });

    // Populate author information
    await post.populate('author', 'username');

    res.status(201).json({
      success: true,
      data: post
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating post',
      error: error.message
    });
  }
};

// Update post
export const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user is post author
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this post'
      });
    }

    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedPost
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating post',
      error: error.message
    });
  }
};

// Delete post
export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user is post author
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    // Use deleteOne instead of remove()
    await Post.deleteOne({ _id: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting post',
      error: error.message
    });
  }
};

// Like/Unlike post
export const toggleLike = async (req, res) => {
  try {
    console.log('Toggling like for post:', req.params.id);
    console.log('User ID:', req.user._id);

    const post = await Post.findById(req.params.id)
      .populate('author', '_id');

    if (!post) {
      console.log('Post not found:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Initialize reactions array if it doesn't exist
    if (!post.reactions) {
      post.reactions = [];
    }

    // Check if user already reacted
    const existingReactionIndex = post.reactions.findIndex(
      r => r.user && r.user.toString() === req.user._id.toString() && r.type === 'like'
    );

    console.log('Existing reaction index:', existingReactionIndex);

    if (existingReactionIndex === -1) {
      // Add like reaction
      const newReaction = {
        user: req.user._id,
        type: 'like',
        createdAt: new Date()
      };
      console.log('Adding new reaction:', newReaction);
      post.reactions.push(newReaction);

      // Create notification for the post author
      if (post.author && post.author._id.toString() !== req.user._id.toString()) {
        try {
          await Notification.create({
            recipient: post.author._id,
            sender: req.user._id,
            type: 'reaction',
            post: post._id
          });
        } catch (notificationError) {
          console.error('Error creating notification:', notificationError);
          // Don't fail the whole request if notification creation fails
        }
      }
    } else {
      // Remove like reaction
      console.log('Removing existing reaction at index:', existingReactionIndex);
      post.reactions.splice(existingReactionIndex, 1);
    }

    console.log('Saving post with reactions:', post.reactions);
    const savedPost = await post.save();

    // Populate the updated post
    const updatedPost = await Post.findById(savedPost._id)
      .populate('author', 'username')
      .populate('reactions.user', 'username');

    console.log('Sending response with updated post');
    res.status(200).json({
      success: true,
      data: updatedPost
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error toggling like',
      error: error.message
    });
  }
};

// Add comment
export const addComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const comment = {
      user: req.user._id,
      content: req.body.content
    };

    post.comments.push(comment);
    await post.save();

    res.status(200).json({
      success: true,
      data: post
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding comment',
      error: error.message
    });
  }
};

// Get posts by user ID
export const getPostsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find all posts by this user in MongoDB
    const posts = await Post.find({ author: userId })
      .sort({ createdAt: -1 })
      .populate('author', 'username')
      .populate('comments.user', 'username');

    res.status(200).json({
      success: true,
      data: posts
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user posts',
      error: error.message
    });
  }
};

// Add reaction to post
export const addReaction = async (req, res) => {
  try {
    console.log('Adding reaction to post:', req.params.id);
    console.log('Reaction data:', req.body);
    console.log('User ID:', req.user._id);

    const post = await Post.findById(req.params.id)
      .populate('author', '_id');

    if (!post) {
      console.log('Post not found:', req.params.id);
      return res.status(404).json({ message: 'Post not found' });
    }

    const { type } = req.body;
    const userId = req.user._id;

    if (!type || !['like', 'love', 'haha', 'wow', 'sad', 'angry'].includes(type)) {
      console.log('Invalid reaction type:', type);
      return res.status(400).json({ message: 'Valid reaction type is required' });
    }

    // Initialize reactions array if it doesn't exist
    if (!post.reactions) {
      post.reactions = [];
    }

    // Check if user already reacted
    const existingReactionIndex = post.reactions.findIndex(
      r => r.user && r.user.toString() === userId.toString()
    );

    if (existingReactionIndex !== -1) {
      console.log('Updating existing reaction');
      // Update existing reaction
      post.reactions[existingReactionIndex].type = type;
      post.reactions[existingReactionIndex].createdAt = new Date();
    } else {
      console.log('Adding new reaction');
      // Add new reaction
      post.reactions.push({
        user: userId,
        type: type,
        createdAt: new Date()
      });

      // Create notification for the post author
      if (post.author && post.author._id.toString() !== userId.toString()) {
        console.log('Creating notification for post author:', post.author._id);
        try {
          await Notification.create({
            recipient: post.author._id,
            sender: userId,
            type: 'reaction',
            post: post._id
          });
          console.log('Notification created successfully');
        } catch (notificationError) {
          console.error('Error creating notification:', notificationError);
          // Don't fail the whole request if notification creation fails
        }
      }
    }

    console.log('Saving post with reactions:', post.reactions);
    const savedPost = await post.save();
    console.log('Post saved successfully');

    // Populate the updated post
    const updatedPost = await Post.findById(savedPost._id)
      .populate('author', 'username')
      .populate('reactions.user', 'username');

    res.json(updatedPost);
  } catch (error) {
    console.error('Error adding reaction:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Error adding reaction',
      error: error.message
    });
  }
}; 