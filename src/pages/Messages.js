import * as THREE from 'three';
import { makeAuthenticatedRequest } from '../utils/api.js';

export class Messages {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.isActive = false;
    this.messages = new Map(); // Map of userId -> messages
    this.currentChat = null;
    this.allUsers = []; // Store all users for search functionality
    
    // Get DOM elements
    this.chatList = document.getElementById('chat-list');
    this.usersList = document.getElementById('users-list');
    this.chatContent = document.getElementById('chat-content');
    this.messageInput = document.getElementById('message-input');
    this.sendButton = document.getElementById('send-button');
    this.userSearch = document.getElementById('user-search');
    
    // Bind methods
    this.handleSend = this.handleSend.bind(this);
    this.handleKeyPress = this.handleKeyPress.bind(this);
    this.handleSearch = this.handleSearch.bind(this);
    this.animate = this.animate.bind(this);
    
    // Add event listeners
    this.sendButton.addEventListener('click', this.handleSend);
    this.messageInput.addEventListener('keypress', this.handleKeyPress);
    this.userSearch.addEventListener('input', this.handleSearch);
  }

  async show() {
    console.log('Showing Messages page');
    
    // Load all users and their messages
    await this.loadUsers();
    
    // Start animation loop
    this.animate();
    
    this.isActive = true;
  }

  async loadUsers() {
    try {
      const response = await makeAuthenticatedRequest('/api/users');
      const users = await response.json();
      
      if (Array.isArray(users)) {
        // Store all users for search functionality
        this.allUsers = users.filter(user => 
          user._id !== JSON.parse(localStorage.getItem('currentUser'))._id
        );
        
        // Display all users initially
        this.displayUsers(this.allUsers);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users. Please try again.');
    }
  }

  displayUsers(users) {
    // Clear existing users
    this.usersList.innerHTML = '';
    
    // Create user list items
    users.forEach(user => {
      const chatItem = document.createElement('div');
      chatItem.className = 'chat-item';
      chatItem.textContent = user.username;
      chatItem.onclick = () => this.selectChat(user);
      this.usersList.appendChild(chatItem);
    });
  }

  handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase().trim();
    
    if (searchTerm === '') {
      // If search is empty, show all users
      this.displayUsers(this.allUsers);
      return;
    }
    
    // Filter users based on search term
    const filteredUsers = this.allUsers.filter(user => 
      user.username.toLowerCase().includes(searchTerm)
    );
    
    this.displayUsers(filteredUsers);
  }

  async selectChat(user) {
    console.log('Selecting chat with user:', user);
    this.currentChat = user;
    
    // Clear chat content except input container
    const inputContainer = document.getElementById('message-input-container');
    this.chatContent.innerHTML = '';
    this.chatContent.appendChild(inputContainer);
    
    // Load messages for this user
    await this.loadMessages(user._id);
  }

  async loadMessages(userId) {
    try {
      const response = await makeAuthenticatedRequest(`/api/messages/${userId}`);
      const messages = await response.json();
      
      if (Array.isArray(messages)) {
        this.messages.set(userId, messages);
        this.displayMessages(messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      alert('Failed to load messages. Please try again.');
    }
  }

  displayMessages(messages) {
    try {
      // Clear existing messages first
      const existingMessages = this.chatContent.querySelectorAll('.message');
      existingMessages.forEach(msg => {
        if (msg !== this.chatContent.lastElementChild) {
          msg.remove();
        }
      });
      
      // Get current user ID safely
      let currentUserId = null;
      try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        currentUserId = currentUser._id;
        if (!currentUserId) {
          console.warn('Current user ID not found in localStorage');
        }
      } catch (e) {
        console.error('Error parsing current user from localStorage:', e);
      }

      // Add new messages
      messages.forEach(message => {
        const messageDiv = document.createElement('div');
        
        // Safely determine if this message was sent by current user
        let isSentByCurrentUser = false;
        try {
          // Check if sender exists and has _id property
          if (message.sender && message.sender._id) {
            isSentByCurrentUser = message.sender._id === currentUserId;
          } 
          // Fallback to sender as a string ID
          else if (typeof message.sender === 'string') {
            isSentByCurrentUser = message.sender === currentUserId;
          }
        } catch (e) {
          console.warn('Error determining message sender:', e);
        }
        
        messageDiv.className = `message ${isSentByCurrentUser ? 'sent' : 'received'}`;
        messageDiv.textContent = message.content;
        this.chatContent.insertBefore(messageDiv, this.chatContent.lastElementChild);
      });

      // Scroll to bottom
      this.chatContent.scrollTop = this.chatContent.scrollHeight;
    } catch (error) {
      console.error('Error displaying messages:', error);
    }
  }

  async handleSend() {
    if (!this.currentChat || !this.messageInput.value.trim()) return;
    
    try {
      const response = await makeAuthenticatedRequest(
        '/api/messages', 
        'POST', 
        {
          recipient: this.currentChat._id,
          content: this.messageInput.value.trim()
        }
      );

      const message = await response.json();
      if (message) {
        // Update local messages state
        const messages = this.messages.get(this.currentChat._id) || [];
        messages.push(message);
        this.messages.set(this.currentChat._id, messages);
        
        // Display all messages again to ensure proper order
        this.displayMessages(messages);
        
        // Clear input
        this.messageInput.value = '';
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    }
  }

  handleKeyPress(event) {
    if (event.key === 'Enter' && this.messageInput.value.trim()) {
      this.handleSend();
    }
  }

  animate() {
    if (!this.isActive) return;
    
    requestAnimationFrame(this.animate.bind(this));
    this.renderer.render(this.scene, this.camera);
  }

  hide() {
    this.isActive = false;
    // Remove event listeners
    this.sendButton.removeEventListener('click', this.handleSend);
    this.messageInput.removeEventListener('keypress', this.handleKeyPress);
    this.userSearch.removeEventListener('input', this.handleSearch);
  }
} 