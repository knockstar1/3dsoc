import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Helper function to sanitize character data by removing any large FBX data
const sanitizeCharacterData = (character) => {
    if (!character) return null;
    
    // Create a sanitized copy of the character
    const sanitized = { ...character };
    
    // Remove any fbx or large model data properties
    if (sanitized._doc) {
        sanitized._doc = { ...sanitized._doc };
        delete sanitized._doc.fbxModel;
        delete sanitized._doc.fbxData;
        delete sanitized._doc.modelData;
    } else {
        delete sanitized.fbxModel;
        delete sanitized.fbxData;
        delete sanitized.modelData;
    }

    // Handle nested objects in variations
    if (sanitized.variations) {
        for (const key in sanitized.variations) {
            if (sanitized.variations[key] && typeof sanitized.variations[key] === 'object') {
                delete sanitized.variations[key].fbxModel;
                delete sanitized.variations[key].fbxData;
                delete sanitized.variations[key].modelData;
            }
        }
    }
    
    return sanitized;
};

export const registerUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Create default character data
        const defaultCharacter = {
            variations: {
                head: 0,
                teeth: 0,
                shirt: 0,
                belt: 0,
                pants: 0,
                shoes: 0
            },
            colors: {
                head: 0xffcc99,
                teeth: 0xffffff,
                shirt: 0x0000ff,
                belt: 0x000000,
                pants: 0x000080,
                shoes: 0x222222
            }
        };

        // Create new user with default character
        const user = new User({
            username,
            password,
            character: defaultCharacter
        });

        await user.save();

        // Create token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User created successfully',
            token,
            userId: user._id,
            username: user.username,
            bio: user.bio || '',
            character: defaultCharacter
        });
    } catch (error) {
        res.status(500).json({ message: 'Error creating user', error: error.message });
    }
};

export const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Create token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Sanitize character data to remove any FBX data
        const sanitizedCharacter = sanitizeCharacterData(user.character);

        res.json({
            message: 'Login successful',
            token,
            userId: user._id,
            username: user.username,
            bio: user.bio,
            character: sanitizedCharacter
        });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
};

export const verifyToken = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Sanitize character data to remove any FBX data
        const sanitizedCharacter = sanitizeCharacterData(user.character);

        res.status(200).json({
            _id: user._id,
            username: user.username,
            bio: user.bio,
            character: sanitizedCharacter
        });
    } catch (error) {
        console.error('Error verifying user:', error);
        res.status(500).json({ message: 'Error verifying user' });
    }
};

export const updateCharacter = async (req, res) => {
    try {
        console.log(`PUT /api/users/character: Updating character for user ID ${req.user._id}`);
        console.log('Request body:', 
            req.body.variations ? 'has variations' : 'no variations', 
            req.body.colors ? 'has colors' : 'no colors',
            req.body.bio ? `has bio: ${req.body.bio.substring(0, 20)}...` : 'no bio'
        );
        
        const { variations, colors, bio } = req.body;
        
        // Build update object
        const updateObj = {};
        
        if (variations) {
            updateObj['character.variations'] = variations;
        }
        
        if (colors) {
            updateObj['character.colors'] = colors;
        }
        
        if (bio !== undefined) {
            updateObj.bio = bio;
        }

        console.log('Update object keys:', Object.keys(updateObj));

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updateObj },
            { new: true }
        ).select('-password');

        if (!updatedUser) {
            console.log(`User with ID ${req.user._id} not found during update`);
            return res.status(404).json({ message: 'User not found' });
        }

        // Sanitize character data
        const sanitizedCharacter = sanitizeCharacterData(updatedUser.character);
        console.log('Character updated successfully');

        res.json({
            character: sanitizedCharacter,
            bio: updatedUser.bio
        });
    } catch (error) {
        console.error('Error updating character:', error);
        res.status(500).json({ message: 'Error updating character', error: error.message });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}, '-password -__v').sort({ createdAt: -1 });
        
        // Sanitize character data for all users
        const sanitizedUsers = users.map(user => {
            const userObj = user.toObject();
            userObj.character = sanitizeCharacterData(userObj.character);
            // Make sure bio is included (should already be in the userObj)
            return userObj;
        });
        
        res.json(sanitizedUsers);
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ message: 'Error getting users' });
    }
};

export const getCharacter = async (req, res) => {
    try {
        console.log(`GET /api/users/character: Retrieving character for user ID ${req.user._id}`);
        const user = await User.findById(req.user._id);
        if (!user) {
            console.log(`User with ID ${req.user._id} not found`);
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Sanitize character data to remove any FBX data
        const sanitizedCharacter = sanitizeCharacterData(user.character);
        console.log(`Found character data:`, 
            sanitizedCharacter ? 'has character' : 'no character',
            user.bio ? `has bio: ${user.bio.substring(0, 20)}...` : 'no bio'
        );
        
        // Return both character and bio data
        res.json({
            character: sanitizedCharacter || {},
            bio: user.bio || ''
        });
    } catch (error) {
        console.error('Error fetching character:', error);
        res.status(500).json({ message: 'Error fetching character', error: error.message });
    }
}; 