import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';

// Connect to MongoDB
try {
    await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Users to migrate from localStorage
    const usersToMigrate = [
        {
            username: '1',
            password: '1',
            character: {
                variations: {
                    head: 0,
                    teeth: 0,
                    shirt: 2,
                    belt: 2,
                    pants: 2,
                    shoes: 2
                },
                colors: {
                    head: 0xffcc99,
                    teeth: 0xffffff,
                    shirt: 0x0000ff,
                    belt: 0x000000,
                    pants: 0x000080,
                    shoes: 0x222222
                }
            }
        },
        {
            username: 'knxtar',
            password: 'getmoney27',
            character: {
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
            }
        },
        {
            username: 'knock',
            password: '1111',
            character: {
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
            }
        }
    ];

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Create new users
    for (const userData of usersToMigrate) {
        const user = new User(userData);
        await user.save();
        console.log(`Created user: ${userData.username}`);
    }

    console.log('Migration completed successfully');
} catch (error) {
    console.error('Migration failed:', error);
} finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
} 