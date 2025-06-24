import * as THREE from 'three';
import { makeAuthenticatedRequest } from '../utils/api.js';

export class Notifications {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.notifications = [];
    
    // Use the existing notifications-list container
    this.notificationsList = document.getElementById('notifications-list');
    if (!this.notificationsList) {
      this.notificationsList = document.createElement('div');
      this.notificationsList.id = 'notifications-list';
      
      const container = document.getElementById('notifications-container');
      if (container) {
        container.appendChild(this.notificationsList);
      } else {
        document.body.appendChild(this.notificationsList);
      }
    }
    
    // Use styling from CSS, do not override it here
    this.isActive = false;
    this.isLoading = false;
    
    // Create confetti container
    this.confettiContainer = new THREE.Group();
    this.scene.add(this.confettiContainer);
    
    // Create particle materials with different colors
    this.particleMaterials = [
      new THREE.PointsMaterial({ color: 0xff0000, size: 0.1, transparent: true }),
      new THREE.PointsMaterial({ color: 0x00ff00, size: 0.1, transparent: true }),
      new THREE.PointsMaterial({ color: 0x0000ff, size: 0.1, transparent: true }),
      new THREE.PointsMaterial({ color: 0xffff00, size: 0.1, transparent: true }),
      new THREE.PointsMaterial({ color: 0xff00ff, size: 0.1, transparent: true }),
      new THREE.PointsMaterial({ color: 0x00ffff, size: 0.1, transparent: true })
    ];
    
    // Store active confetti particles
    this.activeConfetti = [];
    
    // Bind methods
    this.animate = this.animate.bind(this);
    this.createConfetti = this.createConfetti.bind(this);
    this.updateConfetti = this.updateConfetti.bind(this);
    
    // Setup 3D background
    this.setupBackground();
    
    // Add escape key handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isActive) {
        this.returnToHome();
      }
    });
  }
  
  setupBackground() {
    // Create a more dense starfield background
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.8
    });
    
    const starsVertices = [];
    for (let i = 0; i < 2000; i++) {
      const x = (Math.random() - 0.5) * 150;
      const y = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    this.stars = new THREE.Points(starsGeometry, starsMaterial);
    this.scene.add(this.stars);
    
    // Add some colored stars
    const coloredStarsGeometry = new THREE.BufferGeometry();
    const coloredStarsVertices = [];
    
    for (let i = 0; i < 300; i++) {
      const x = (Math.random() - 0.5) * 150;
      const y = (Math.random() - 0.5) * 150;
      const z = (Math.random() - 0.5) * 150;
      coloredStarsVertices.push(x, y, z);
    }
    
    coloredStarsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(coloredStarsVertices, 3));
    
    // Create multiple colored star systems
    const coloredStarMaterials = [
      new THREE.PointsMaterial({ color: 0x4a90e2, size: 0.2, transparent: true }),
      new THREE.PointsMaterial({ color: 0xff9966, size: 0.25, transparent: true }),
      new THREE.PointsMaterial({ color: 0x66ffcc, size: 0.2, transparent: true })
    ];
    
    coloredStarMaterials.forEach(material => {
      const coloredStars = new THREE.Points(coloredStarsGeometry.clone(), material);
      this.scene.add(coloredStars);
      
      // Add some random rotation
      coloredStars.rotation.x = Math.random() * Math.PI;
      coloredStars.rotation.y = Math.random() * Math.PI;
    });
    
    // Set camera position
    this.camera.position.z = 15;
  }

  async show() {
    console.log('Showing Notifications page');
    this.isActive = true;
    
    // Make sure the notificationsList is visible
    if (this.notificationsList) {
      this.notificationsList.style.display = 'block';
    }
    
    // Make sure the app element has proper scrolling but hide scrollbar
    const appElement = document.getElementById('app');
    if (appElement) {
      appElement.style.overflowY = 'auto';
      appElement.style.scrollbarWidth = 'none'; // Firefox
      appElement.style.msOverflowStyle = 'none'; // IE/Edge
      
      // For Chrome/Safari/Opera
      const style = document.createElement('style');
      style.textContent = '#app::-webkit-scrollbar { display: none; }';
      document.head.appendChild(style);
    }
    
    // Position the camera for this view
    this.camera.position.z = 15;
    this.camera.lookAt(0, 0, 0);
    
    // Show the return to home button
    const returnButton = document.getElementById('return-button');
    if (returnButton) {
      returnButton.style.display = 'block';
    }
    
    this.showLoading();
    await this.loadNotifications();
    this.hideLoading();
    this.animate();
  }

  showLoading() {
    this.isLoading = true;
    this.notificationsList.innerHTML = '<div class="loading">Loading notifications...</div>';
  }

  hideLoading() {
    this.isLoading = false;
  }

  async loadNotifications() {
    try {
      const response = await makeAuthenticatedRequest('/api/notifications');
      if (!response.ok) {
        throw new Error('Failed to load notifications');
      }
      const data = await response.json();
      this.notifications = Array.isArray(data) ? data : [];
      this.displayNotifications();
    } catch (error) {
      console.error('Error loading notifications:', error);
      this.showError('Failed to load notifications. Please try again.');
    }
  }

  showError(message) {
    this.notificationsList.innerHTML = `<div class="error">${message}</div>`;
  }

  displayNotifications() {
    this.notificationsList.innerHTML = '';
    
    if (this.notifications.length === 0) {
      const noNotifications = document.createElement('div');
      noNotifications.className = 'no-notifications';
      noNotifications.innerHTML = '<p>No notifications yet</p><p class="subdued">When you receive notifications, they will appear here</p>';
      this.notificationsList.appendChild(noNotifications);
      return;
    }
    
    this.notifications.forEach(notification => {
      const notificationElement = document.createElement('div');
      notificationElement.className = `notification ${notification.isRead ? 'read' : 'unread'}`;
      
      // Make notification container transparent for confetti effect
      notificationElement.style.backgroundColor = 'transparent';
      notificationElement.style.backdropFilter = 'none';
      
      // Add an inner container for content with only a border
      const innerContainer = document.createElement('div');
      innerContainer.className = 'notification-inner';
      innerContainer.style.backgroundColor = 'transparent';
      innerContainer.style.backdropFilter = 'none';
      innerContainer.style.borderRadius = '15px';
      innerContainer.style.padding = '20px';
      innerContainer.style.border = notification.isRead ? 
        '2px solid rgba(74, 144, 226, 0.5)' : 
        '2px solid #4a90e2';
      
      if (!notification.isRead) {
        innerContainer.style.boxShadow = '0 4px 12px rgba(74, 144, 226, 0.3)';
      }
      
      const avatar = document.createElement('div');
      avatar.className = 'notification-avatar';
      
      const senderUsername = notification?.sender?.username || 'U';
      avatar.textContent = senderUsername.charAt(0).toUpperCase();
      
      const content = document.createElement('div');
      content.className = 'notification-content';
      
      const message = document.createElement('div');
      message.className = 'notification-message';
      
      let messageText = '';
      if (notification.type === 'reaction') {
        messageText = `${senderUsername} reacted to your post`;
      } else if (notification.type === 'comment') {
        messageText = `${senderUsername} commented on your post`;
      } else {
        messageText = `${senderUsername} interacted with your post`;
      }
      
      const postPreview = document.createElement('span');
      postPreview.className = 'notification-post';
      
      const postText = notification?.post?.content || '';
      postPreview.textContent = `"${postText.substring(0, 30)}${postText.length > 30 ? '...' : ''}"`;
      
      message.appendChild(document.createTextNode(messageText + ' '));
      message.appendChild(postPreview);
      
      const time = document.createElement('div');
      time.className = 'notification-time';
      time.textContent = new Date(notification.createdAt).toLocaleString();
      
      const markReadButton = document.createElement('button');
      markReadButton.className = 'mark-read';
      markReadButton.textContent = 'Mark as read';
      markReadButton.onclick = (e) => {
        e.stopPropagation();
        this.markAsRead(notification._id);
      };
      
      content.appendChild(message);
      content.appendChild(time);
      if (!notification.isRead) {
        content.appendChild(markReadButton);
      }
      
      innerContainer.appendChild(avatar);
      innerContainer.appendChild(content);
      
      // Add unread indicator
      if (!notification.isRead) {
        const unreadIndicator = document.createElement('div');
        unreadIndicator.className = 'unread-indicator';
        innerContainer.appendChild(unreadIndicator);
      }
      
      // Add inner container to notification element
      notificationElement.appendChild(innerContainer);
      
      // Make the notification clickable
      notificationElement.addEventListener('click', () => {
        // Create confetti effect centered on this notification
        const rect = notificationElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Convert to normalized device coordinates (-1 to +1)
        const x = (centerX / window.innerWidth) * 2 - 1;
        const y = -(centerY / window.innerHeight) * 2 + 1;
        
        this.createConfetti(x, y);
        
        // Expand notification with post details
        this.expandNotificationDetails(notification, innerContainer);
        
        // Mark as read if not already
        if (!notification.isRead) {
          this.markAsRead(notification._id);
        }
      });
      
      this.notificationsList.appendChild(notificationElement);
    });
  }
  
  expandNotificationDetails(notification, notificationElement) {
    // Check if already expanded
    if (notificationElement.querySelector('.expanded-details')) {
      notificationElement.querySelector('.expanded-details').remove();
      return;
    }
    
    // Create expanded details container
    const expandedDetails = document.createElement('div');
    expandedDetails.className = 'expanded-details';
    
    // Style to match the transparent with border style
    expandedDetails.style.backgroundColor = 'transparent';
    expandedDetails.style.border = '2px solid #4a90e2';
    expandedDetails.style.borderRadius = '12px';
    expandedDetails.style.boxShadow = '0 0 15px rgba(74, 144, 226, 0.4)';
    expandedDetails.style.backdropFilter = 'none';
    expandedDetails.style.color = 'white';
    
    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading';
    loadingIndicator.textContent = 'Loading details...';
    expandedDetails.appendChild(loadingIndicator);
    
    // Add expanded details to notification
    notificationElement.appendChild(expandedDetails);
    
    // Animate opening immediately
    requestAnimationFrame(() => {
      expandedDetails.style.maxHeight = '500px';
    });
    
    // Fetch post details
    this.fetchPostDetails(notification.post?._id).then(postDetails => {
      // Remove loading indicator
      expandedDetails.removeChild(loadingIndicator);
      
      if (!postDetails) {
        // Even if we can't get post details, show what we know from the notification
        const senderInfo = document.createElement('div');
        senderInfo.className = 'sender-info';
        senderInfo.style.fontSize = '18px';
        senderInfo.style.margin = '10px 0';
        senderInfo.style.color = '#4a90e2';
        senderInfo.style.textShadow = '0 0 10px rgba(74, 144, 226, 0.5)';
        
        // Use the data from notification
        const senderName = notification.sender?.username || 'Unknown';
        const createdAt = notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Unknown date';
        senderInfo.textContent = `${senderName} interacted on ${createdAt}`;
        expandedDetails.appendChild(senderInfo);
        
        const errorMsg = document.createElement('p');
        errorMsg.style.color = 'white';
        errorMsg.textContent = 'Full post details are currently unavailable.';
        expandedDetails.appendChild(errorMsg);
        
        // Add "View in Home" button to redirect to the homepage
        const viewButton = document.createElement('button');
        viewButton.className = 'view-button';
        viewButton.textContent = 'View in Home';
        viewButton.addEventListener('click', (e) => {
          e.stopPropagation();
          const senderId = notification.sender?._id;
          this.viewPost(notification.post?._id, senderId);
        });
        expandedDetails.appendChild(viewButton);
        
        return;
      }
      
      // Post content
      const postContent = document.createElement('div');
      postContent.className = 'post-content';
      postContent.style.color = 'white';
      postContent.style.fontSize = '18px';
      postContent.style.fontWeight = 'bold';
      postContent.style.margin = '10px 0';
      postContent.textContent = postDetails.content || 'No content available';
      expandedDetails.appendChild(postContent);
      
      // Sender/Author info
      const senderInfo = document.createElement('div');
      senderInfo.className = 'sender-info';
      senderInfo.style.fontSize = '16px';
      senderInfo.style.margin = '10px 0';
      senderInfo.style.color = '#4a90e2';
      senderInfo.style.textShadow = '0 0 10px rgba(74, 144, 226, 0.5)';
      
      // Combine notification and post data for more complete info
      const authorName = postDetails.author?.username || notification.sender?.username || 'Unknown';
      const createdAt = postDetails.createdAt ? new Date(postDetails.createdAt).toLocaleString() : notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Unknown date';
      
      senderInfo.innerHTML = `Posted by: <span style="font-weight: bold;">${authorName}</span> on ${createdAt}`;
      expandedDetails.appendChild(senderInfo);
      
      // Reaction info
      const reactionInfo = document.createElement('div');
      reactionInfo.className = 'reaction-info';
      reactionInfo.style.margin = '15px 0';
      
      // Add who reacted (from notification data)
      if (notification.sender) {
        const reactorInfo = document.createElement('div');
        reactorInfo.style.color = '#4a90e2';
        reactorInfo.style.fontSize = '16px';
        reactorInfo.style.marginBottom = '10px';
        
        const reactionType = notification.type === 'reaction' ? 'reacted' : 
                             notification.type === 'comment' ? 'commented' : 'interacted';
        
        reactorInfo.innerHTML = `<span style="font-weight: bold;">${notification.sender.username}</span> ${reactionType} to this post`;
        reactionInfo.appendChild(reactorInfo);
      }
      
      // Reactions section
      if (postDetails.reactions && postDetails.reactions.length > 0) {
        const reactionsTitle = document.createElement('div');
        reactionsTitle.className = 'reactions-title';
        reactionsTitle.style.fontSize = '16px';
        reactionsTitle.style.fontWeight = 'bold';
        reactionsTitle.style.color = '#4a90e2';
        reactionsTitle.style.marginTop = '10px';
        reactionsTitle.textContent = 'All reactions:';
        reactionInfo.appendChild(reactionsTitle);
        
        const reactionsList = document.createElement('div');
        reactionsList.className = 'reactions-list';
        
        // Group reactions by type
        const reactionTypes = {};
        postDetails.reactions.forEach(reaction => {
          if (!reactionTypes[reaction.type]) {
            reactionTypes[reaction.type] = [];
          }
          reactionTypes[reaction.type].push(reaction);
        });
        
        // Create reaction badges
        Object.entries(reactionTypes).forEach(([type, reactions]) => {
          const badge = document.createElement('div');
          badge.className = 'reaction-badge';
          
          // Map reaction type to emoji
          const emoji = this.getReactionEmoji(type);
          
          badge.innerHTML = `${emoji} <span>${reactions.length}</span>`;
          
          // Show users who reacted on hover
          const tooltip = document.createElement('div');
          tooltip.className = 'tooltip';
          
          // Add username of each person who reacted
          tooltip.innerHTML = reactions.map(r => 
            r.user ? r.user.username : 'Unknown user'
          ).join('<br>');
          
          document.body.appendChild(tooltip);
          
          badge.addEventListener('mouseenter', (e) => {
            tooltip.style.display = 'block';
            tooltip.style.left = `${e.pageX}px`;
            tooltip.style.top = `${e.pageY - 30}px`;
          });
          
          badge.addEventListener('mousemove', (e) => {
            tooltip.style.left = `${e.pageX}px`;
            tooltip.style.top = `${e.pageY - 30}px`;
          });
          
          badge.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
          });
          
          reactionsList.appendChild(badge);
        });
        
        reactionInfo.appendChild(reactionsList);
      } else {
        const noReactions = document.createElement('div');
        noReactions.className = 'no-reactions';
        noReactions.style.color = '#999';
        noReactions.style.fontSize = '14px';
        noReactions.textContent = 'No reactions yet';
        reactionInfo.appendChild(noReactions);
      }
      
      expandedDetails.appendChild(reactionInfo);
      
      // Add "View in Home" button with sender ID parameter
      const viewButton = document.createElement('button');
      viewButton.className = 'view-button';
      viewButton.style.backgroundColor = '#4a90e2';
      viewButton.style.color = 'white';
      viewButton.style.border = 'none';
      viewButton.style.padding = '8px 15px';
      viewButton.style.borderRadius = '4px';
      viewButton.style.cursor = 'pointer';
      viewButton.style.marginTop = '15px';
      viewButton.style.boxShadow = '0 0 10px rgba(74, 144, 226, 0.5)';
      viewButton.textContent = 'View in Home';
      viewButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const senderId = notification.sender?._id || postDetails.author?._id;
        this.viewPost(notification.post?._id, senderId);
      });
      expandedDetails.appendChild(viewButton);
    });
  }
  
  getReactionEmoji(type) {
    const emojiMap = {
      'like': '👍',
      'love': '❤️',
      'haha': '😂',
      'wow': '😮',
      'sad': '😢',
      'angry': '😠'
    };
    
    return emojiMap[type] || '👍';
  }
  
  async fetchPostDetails(postId) {
    try {
      const response = await makeAuthenticatedRequest(`/api/posts/${postId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error(`Error fetching post details for ID ${postId}:`, error);
      throw error;
    }
  }

  async markAsRead(notificationId) {
    try {
      const response = await makeAuthenticatedRequest(`/api/notifications/${notificationId}/read`, 'PUT');
      if (!response.ok) {
        throw new Error(`Failed to mark notification ${notificationId} as read`);
      }
      return response.json();
    } catch (error) {
      console.error(`Error marking notification ${notificationId} as read:`, error);
      throw error;
    }
  }

  async deleteNotification(notificationId) {
    try {
      const response = await makeAuthenticatedRequest(`/api/notifications/${notificationId}`, 'DELETE');
      if (!response.ok) {
        throw new Error(`Failed to delete notification ${notificationId}`);
      }
      return response.json();
    } catch (error) {
      console.error(`Error deleting notification ${notificationId}:`, error);
      throw error;
    }
  }

  async viewPost(postId, senderId) {
    if (!postId) {
      console.error('No post ID provided');
      return;
    }
    try {
      // Include both post ID and sender ID in the URL to show the character who interacted
      let url = `/?post=${postId}`;
      if (senderId) {
        url += `&character=${senderId}`;
      }
      window.location.href = url;
    } catch (error) {
      console.error('Error navigating to post:', error);
      this.showError('Failed to view post');
    }
  }
  
  returnToHome() {
    window.location.href = '/';
  }
  
  createConfetti(x = 0, y = 0) {
    // Convert normalized coordinates back to world coordinates
    const vector = new THREE.Vector3(x, y, -3);
    vector.unproject(this.camera);
    
    // Create 100 particles
    for (let i = 0; i < 100; i++) {
      const geometry = new THREE.BufferGeometry();
      const vertices = [];
      
      // Single vertex for each particle
      vertices.push(0, 0, 0);
      
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      
      // Pick a random material color
      const material = this.particleMaterials[Math.floor(Math.random() * this.particleMaterials.length)];
      
      // Create the particle system
      const particles = new THREE.Points(geometry, material);
      
      // Position at the clicked position
      particles.position.set(
        vector.x + (Math.random() - 0.5) * 2,
        vector.y + (Math.random() - 0.5) * 2,
        vector.z
      );
      
      // Random velocity
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        Math.random() * 0.1,
        (Math.random() - 0.5) * 0.1
      );
      
      // Add to scene
      this.confettiContainer.add(particles);
      
      // Store particle data for animation
      this.activeConfetti.push({
        particle: particles,
        velocity: velocity,
        life: 100 + Math.random() * 100, // Random lifespan
        gravity: 0.001 + Math.random() * 0.003 // Random gravity
      });
    }
    
    // Play a sound when confetti is created
    const confettiSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    confettiSound.volume = 0.2;
    confettiSound.play().catch(e => console.log('Error playing confetti sound:', e));
  }
  
  updateConfetti() {
    // Update each confetti particle
    for (let i = this.activeConfetti.length - 1; i >= 0; i--) {
      const confetti = this.activeConfetti[i];
      
      // Apply velocity and gravity
      confetti.particle.position.add(confetti.velocity);
      confetti.velocity.y -= confetti.gravity;
      
      // Add a slight spin
      confetti.particle.rotation.x += 0.01;
      confetti.particle.rotation.y += 0.01;
      
      // Decrease life
      confetti.life -= 1;
      
      // If particle is dead, remove it
      if (confetti.life <= 0) {
        this.confettiContainer.remove(confetti.particle);
        this.activeConfetti.splice(i, 1);
      } else {
        // Fade out as life decreases
        confetti.particle.material.opacity = confetti.life / 100;
      }
    }
  }

  animate() {
    if (!this.isActive) return;
    
    requestAnimationFrame(this.animate.bind(this));
    
    // Rotate stars for background effect
    if (this.stars) {
      this.stars.rotation.y += 0.0003;
    }
    
    // Update confetti particles
    if (this.activeConfetti.length > 0) {
      this.updateConfetti();
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  hide() {
    this.isActive = false;
    
    // Hide the notifications list
    if (this.notificationsList) {
      this.notificationsList.style.display = 'none';
    }
    
    // Hide the return button
    const returnButton = document.getElementById('return-button');
    if (returnButton) {
      returnButton.style.display = 'none';
    }
    
    // Clear all confetti
    this.activeConfetti.forEach(confetti => {
      this.confettiContainer.remove(confetti.particle);
    });
    this.activeConfetti = [];
    
    // Remove stars background
    if (this.stars) {
      this.scene.remove(this.stars);
    }
  }
} 