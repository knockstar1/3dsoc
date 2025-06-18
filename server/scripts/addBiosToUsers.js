import mongoose from 'mongoose';
import User from '../models/User.js';

// Connect to MongoDB
try {
    await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Find all users without bios
    const users = await User.find({ bio: { $exists: false } });
    console.log(`Found ${users.length} users without bios`);

    // Add default bios
    for (const user of users) {
        user.bio = `Hello, I'm ${user.username}! Welcome to my space.`;
        await user.save();
        console.log(`Added bio for user ${user.username}`);
    }

    console.log('Bio migration complete');
    process.exit(0);
} catch (error) {
    console.error('Error in migration:', error);
    process.exit(1);
} 