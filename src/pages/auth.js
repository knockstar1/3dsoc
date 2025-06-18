import { CharacterCreator } from './CharacterCreator';

export class Auth {
    constructor() {
        this.characterCreator = null;
        this.init();
    }

    init() {
        // Hide auth modal and character creation UI initially
        const authModal = document.getElementById('auth-modal');
        const characterCreation = document.querySelector('.character-creation');
        if (authModal) authModal.style.display = 'none';
        if (characterCreation) characterCreation.style.display = 'none';

        this.setupEventListeners();
    }

    setupEventListeners() {
        const signInForm = document.getElementById('sign-in-form');
        const registerForm = document.getElementById('register-form');
        const showRegister = document.getElementById('show-register');
        const showSignIn = document.getElementById('show-signin');
        const signInSection = document.getElementById('sign-in-section');
        const registerSection = document.getElementById('register-section');

        // Handle sign in form submission
        if (signInForm) {
            signInForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('signin-username').value;
                const password = document.getElementById('signin-password').value;
                
                try {
                    // Clear storage before attempting to login
                    this.clearLocalStorage();
                    
                    const response = await fetch(`https://threedsocbackend.onrender.com/api/users/login`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username, password })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Login failed');
                    }

                    const data = await response.json();
                    
                    try {
                        // Only store essential user data - avoid storing large character data
                        localStorage.setItem('token', data.token);
                        
                        // Store minimal user data
                        const minimalUserData = {
                            _id: data.userId,
                            username: data.username
                        };
                        
                        // Only include character if it's not too large
                        if (data.character && !this.isDataTooLarge(data.character)) {
                            minimalUserData.character = data.character;
                        }
                        
                        localStorage.setItem('currentUser', JSON.stringify(minimalUserData));
                    } catch (storageError) {
                        console.error('Storage error:', storageError);
                        // If fails, try with absolute minimal data
                        this.clearLocalStorage();
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('currentUser', JSON.stringify({ 
                            _id: data.userId,
                            username: data.username
                        }));
                    }
                    
                    // Verify token before proceeding
                    const verifyResponse = await fetch(`https://threedsocbackend.onrender.com/api/users/verify`, {
                        headers: {
                            'Authorization': `Bearer ${data.token}`
                        }
                    });

                    if (!verifyResponse.ok) {
                        // Clear stored data if verification fails
                        localStorage.removeItem('token');
                        localStorage.removeItem('currentUser');
                        throw new Error('Token verification failed');
                    }

                    this.hide();
                    window.dispatchEvent(new CustomEvent('navigate', { 
                        detail: { page: 'home' } 
                    }));
                } catch (error) {
                    console.error('Login error:', error);
                    alert('Login failed. Please check your credentials.');
                }
            });
        }

        // Handle register form submission
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const username = document.getElementById('register-username').value;
                const password = document.getElementById('register-password').value;
                const confirmPassword = document.getElementById('register-confirm-password').value;
                
                if (password !== confirmPassword) {
                    alert('Passwords do not match');
                    return;
                }

                try {
                    // Clear storage before registration
                    this.clearLocalStorage();
                    
                    const response = await fetch(`https://threedsocbackend.onrender.com/api/users/register`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username, password })
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Registration failed');
                    }

                    const data = await response.json();
                    
                    try {
                        // Store minimal user data
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('currentUser', JSON.stringify({ 
                            _id: data.userId,
                            username: data.username
                        }));
                    } catch (storageError) {
                        console.error('Storage error:', storageError);
                        // If storage fails, clear and retry with minimal data
                        this.clearLocalStorage();
                        localStorage.setItem('token', data.token);
                        localStorage.setItem('currentUser', JSON.stringify({ 
                            _id: data.userId,
                            username: data.username 
                        }));
                    }

                    this.hide();
                    // For new registrations, redirect to character creator
                    window.location.href = 'character.html';
                } catch (error) {
                    console.error('Registration error:', error);
                    alert('Registration failed. Username might already be taken.');
                }
            });
        }

        // Handle show register/sign in links
        if (showRegister && showSignIn && signInSection && registerSection) {
            showRegister.addEventListener('click', (e) => {
                e.preventDefault();
                signInSection.style.display = 'none';
                registerSection.style.display = 'block';
            });

            showSignIn.addEventListener('click', (e) => {
                e.preventDefault();
                registerSection.style.display = 'none';
                signInSection.style.display = 'block';
            });
        }
    }

    // Helper method to check if data is too large to store
    isDataTooLarge(data, limit = 1000000) { // ~1MB
        try {
            const jsonString = JSON.stringify(data);
            return jsonString.length > limit;
        } catch (error) {
            return true; // If we can't stringify, assume it's too large
        }
    }

    // Helper method to clear localStorage
    clearLocalStorage() {
        try {
            // Remove non-essential items first
            const keysToKeep = ['token', 'currentUser'];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!keysToKeep.includes(key)) {
                    localStorage.removeItem(key);
                }
            }
            
            // If necessary, clear everything
            if (localStorage.length > 0) {
                localStorage.clear();
            }
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            localStorage.clear();
        }
    }

    show() {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.style.display = 'flex';
            // Reset forms
            document.getElementById('sign-in-form')?.reset();
            document.getElementById('register-form')?.reset();
        }
    }

    hide() {
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.style.display = 'none';
        }
    }
}
