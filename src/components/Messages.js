class Messages {
  constructor() {
    this.element = document.createElement('div');
    this.element.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 300px;
      height: 100vh;
      background: white;
      box-shadow: -2px 0 5px rgba(0,0,0,0.1);
      z-index: 1000;
      display: none;
    `;

    // Create user list
    this.userList = document.createElement('div');
    this.userList.style.cssText = `
      height: calc(100% - 60px);
      overflow-y: auto;
      padding: 10px;
    `;

    // Create message list
    this.messageList = document.createElement('div');
    this.messageList.style.cssText = `
      height: calc(100% - 120px);
      overflow-y: auto;
      padding: 10px;
    `;

    // Create message input container
    this.messageInputContainer = document.createElement('div');
    this.messageInputContainer.className = 'message-input-container';
    
    this.messageInput = document.createElement('input');
    this.messageInput.className = 'message-input';
    this.messageInput.placeholder = 'Type a message...';
    
    this.sendButton = document.createElement('button');
    this.sendButton.className = 'send-button';
    this.sendButton.textContent = 'Send';
    
    this.messageInputContainer.appendChild(this.messageInput);
    this.messageInputContainer.appendChild(this.sendButton);
    
    // Add elements to main container
    this.element.appendChild(this.userList);
    this.element.appendChild(this.messageList);
    this.element.appendChild(this.messageInputContainer);
    
    document.body.appendChild(this.element);
    
    this.users = [];
    this.messages = [];
    this.selectedUser = null;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Handle user selection
    this.userList.addEventListener('click', (e) => {
      const userElement = e.target.closest('.user-item');
      if (userElement) {
        const userId = userElement.dataset.userId;
        const user = this.users.find(u => u._id === userId);
        if (user) {
          // Update selected user
          this.selectedUser = user;
          
          // Update UI
          document.querySelectorAll('.user-item').forEach(item => {
            item.classList.remove('selected');
          });
          userElement.classList.add('selected');
          
          // Show message input
          this.messageInputContainer.style.display = 'block';
          
          // Load messages
          this.loadMessages(userId);
        }
      }
    });

    // Handle send button click
    this.sendButton.addEventListener('click', () => this.handleSend());

    // Handle enter key in message input
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleSend();
      }
    });
  }

  async loadUsers() {
    try {
      const response = await makeAuthenticatedRequest('/api/users');
      if (response && Array.isArray(response)) {
        this.users = response;
        this.renderUsers();
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }

  renderUsers() {
    this.userList.innerHTML = '';
    this.users.forEach(user => {
      const userElement = document.createElement('div');
      userElement.className = 'user-item';
      userElement.dataset.userId = user._id;
      userElement.textContent = user.username;
      this.userList.appendChild(userElement);
    });
  }

  async loadMessages(userId) {
    try {
      const response = await makeAuthenticatedRequest(`/api/messages/${userId}`);
      if (response && Array.isArray(response)) {
        this.messages = response;
        this.renderMessages();
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  renderMessages() {
    this.messageList.innerHTML = '';
    this.messages.forEach(message => {
      const messageElement = document.createElement('div');
      messageElement.className = `message ${message.sender._id === localStorage.getItem('userId') ? 'sent' : 'received'}`;
      messageElement.textContent = message.content;
      this.messageList.appendChild(messageElement);
    });
    this.messageList.scrollTop = this.messageList.scrollHeight;
  }

  async handleSend() {
    if (!this.selectedUser || !this.messageInput.value.trim()) return;

    try {
      const response = await makeAuthenticatedRequest('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipient: this.selectedUser._id,
          content: this.messageInput.value.trim()
        })
      });

      if (response) {
        this.messages.push(response);
        this.messageInput.value = '';
        this.renderMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      this.showError('Failed to send message. Please try again.');
    }
  }

  showError(message) {
    if (!this.errorElement) {
      this.errorElement = document.createElement('div');
      this.errorElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        background-color: #ff4444;
        color: white;
        border-radius: 4px;
        z-index: 1000;
      `;
      document.body.appendChild(this.errorElement);
    }

    this.errorElement.textContent = message;
    this.errorElement.style.display = 'block';

    setTimeout(() => {
      this.errorElement.style.display = 'none';
    }, 3000);
  }

  show() {
    this.element.style.display = 'block';
    this.loadUsers();
  }

  hide() {
    this.element.style.display = 'none';
    this.selectedUser = null;
    this.messages = [];
    this.messageInputContainer.style.display = 'none';
    this.render();
  }
}

export default Messages; 