import Message from '../models/Message.js';
import User from '../models/User.js';

// Get conversations (users that current user has messaged with)
export const getConversations = async (req, res) => {
  try {
    // Find all messages where current user is sender or recipient
    const messages = await Message.find({
      $or: [
        { sender: req.user._id },
        { recipient: req.user._id }
      ]
    })
    .populate('sender', 'username')
    .populate('recipient', 'username')
    .sort({ createdAt: -1 });

    // Extract unique users (excluding current user)
    const userMap = new Map();
    
    messages.forEach(message => {
      // Add sender if it's not the current user
      if (message.sender._id.toString() !== req.user._id.toString()) {
        if (!userMap.has(message.sender._id.toString())) {
          userMap.set(message.sender._id.toString(), {
            _id: message.sender._id,
            username: message.sender.username,
            lastMessage: message.content,
            lastMessageDate: message.createdAt
          });
        }
      }
      
      // Add recipient if it's not the current user
      if (message.recipient._id.toString() !== req.user._id.toString()) {
        if (!userMap.has(message.recipient._id.toString())) {
          userMap.set(message.recipient._id.toString(), {
            _id: message.recipient._id,
            username: message.recipient.username,
            lastMessage: message.content,
            lastMessageDate: message.createdAt
          });
        }
      }
    });

    // Convert map to array and sort by last message date
    const conversations = Array.from(userMap.values())
      .sort((a, b) => new Date(b.lastMessageDate) - new Date(a.lastMessageDate));

    res.json(conversations);
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({ message: 'Error getting conversations' });
  }
};

// Get messages between current user and another user
export const getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, recipient: req.params.userId },
        { sender: req.params.userId, recipient: req.user._id }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('sender', 'username')
    .populate('recipient', 'username');

    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ message: 'Error getting messages' });
  }
};

// Send a message to another user
export const sendMessage = async (req, res) => {
  try {
    const { recipient, content } = req.body;

    // Check if recipient exists
    const recipientUser = await User.findById(recipient);
    if (!recipientUser) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const message = await Message.create({
      sender: req.user._id,
      recipient,
      content
    });

    // Populate sender and recipient details
    await message.populate('sender', 'username');
    await message.populate('recipient', 'username');

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
};

// Mark messages as read
export const markAsRead = async (req, res) => {
  try {
    await Message.updateMany(
      {
        sender: req.params.userId,
        recipient: req.user._id,
        read: false
      },
      { read: true }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Error marking messages as read' });
  }
}; 