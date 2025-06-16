import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided. Authentication required.' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set.');
      return res.status(500).json({ message: 'Server configuration error: JWT secret not set.' });
    }

    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'User not found for provided token.' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    console.error('Auth middleware error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      // If it's a JWT error, it might have additional properties like expiredAt, notBefore
      ...(error.name === 'TokenExpiredError' && { expiredAt: error.expiredAt }),
      ...(error.name === 'JsonWebTokenError' && { originalMessage: error.message })
    });
    res.status(401).json({ message: 'Authentication failed.' });
  }
};

export default auth; 