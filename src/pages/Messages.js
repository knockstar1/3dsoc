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
    
    // Load conversations (users that have been messaged)
    await this.loadConversations();
    
    // Check if a user was pre-selected from the home page
    this.checkForPreSelectedUser();
    
    // Start animation loop
    this.animate();
    
    this.isActive = true;
  }

  async loadConversations() {
    try {
      const response = await makeAuthenticatedRequest('/api/messages');
      const conversations = await response.json();
      
      if (Array.isArray(conversations)) {
        // Store conversations for search functionality
        this.allUsers = conversations;
        
        // Display conversations
        this.displayUsers(this.allUsers);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      alert('Failed to load conversations. Please try again.');
    }
  }

  displayUsers(users) {
    // Clear existing users
    this.usersList.innerHTML = '';
    
    // Create user list items
    users.forEach(user => {
      const chatItem = document.createElement('div');
      chatItem.className = 'chat-item';
      
      // Create username element
      const usernameDiv = document.createElement('div');
      usernameDiv.className = 'chat-username';
      usernameDiv.textContent = user.username;
      
      // Create last message preview if available
      if (user.lastMessage) {
        const lastMessageDiv = document.createElement('div');
        lastMessageDiv.className = 'chat-preview';
        lastMessageDiv.textContent = user.lastMessage.length > 50 
          ? user.lastMessage.substring(0, 50) + '...' 
          : user.lastMessage;
        
        chatItem.appendChild(usernameDiv);
        chatItem.appendChild(lastMessageDiv);
      } else {
        chatItem.appendChild(usernameDiv);
      }
      
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
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';
        messageContainer.style.cssText = `
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 10px;
        `;
        
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
        messageDiv.setAttribute('data-message-id', message._id);
        
        // Add delete button for sent messages
        if (isSentByCurrentUser) {
          messageContainer.style.flexDirection = 'row-reverse'; // Align to right
          
          const deleteButton = document.createElement('button');
          deleteButton.textContent = '×';
          deleteButton.className = 'delete-message-btn';
          deleteButton.style.cssText = `
            background: rgba(220, 53, 69, 0.8);
            color: white;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            display: none;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
          `;
          
          // Show delete button on hover
          messageContainer.addEventListener('mouseenter', () => {
            deleteButton.style.display = 'flex';
          });
          
          messageContainer.addEventListener('mouseleave', () => {
            deleteButton.style.display = 'none';
          });
          
          // Handle delete click
          deleteButton.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this message?')) {
              try {
                const response = await makeAuthenticatedRequest(
                  `/api/messages/message/${message._id}`,
                  'DELETE'
                );
                
                if (response.ok) {
                  // Remove message from UI
                  messageContainer.remove();
                  
                  // Update local messages state
                  const messages = this.messages.get(this.currentChat._id) || [];
                  const updatedMessages = messages.filter(m => m._id !== message._id);
                  this.messages.set(this.currentChat._id, updatedMessages);
                } else {
                  alert('Failed to delete message. Please try again.');
                }
              } catch (error) {
                console.error('Error deleting message:', error);
                alert('Failed to delete message. Please try again.');
              }
            }
          });
          
          messageContainer.appendChild(deleteButton);
        }
        
        messageContainer.appendChild(messageDiv);
        this.chatContent.insertBefore(messageContainer, this.chatContent.lastElementChild);
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

  checkForPreSelectedUser() {
    const selectedUser = localStorage.getItem('selectedMessageUser');
    if (selectedUser) {
      try {
        const user = JSON.parse(selectedUser);
        console.log('Pre-selected user found:', user);
        
        // Remove from localStorage so it doesn't persist
        localStorage.removeItem('selectedMessageUser');
        
        // Check if this user is already in our conversations
        const existingUser = this.allUsers.find(u => u._id === user._id);
        if (existingUser) {
          // User exists in conversations, select them
          this.selectChat(existingUser);
        } else {
          // User not in conversations yet, add them and select
          this.allUsers.unshift(user); // Add to beginning of list
          this.displayUsers(this.allUsers);
          this.selectChat(user);
        }
      } catch (error) {
        console.error('Error parsing pre-selected user:', error);
        localStorage.removeItem('selectedMessageUser');
      }
    }
  }

  hide() {
    this.isActive = false;
    // Remove event listeners
    this.sendButton.removeEventListener('click', this.handleSend);
    this.messageInput.removeEventListener('keypress', this.handleKeyPress);
    this.userSearch.removeEventListener('input', this.handleSearch);
  }
} 