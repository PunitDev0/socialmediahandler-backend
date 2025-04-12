import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
export const checkAuth = (req, res) => {
    try {
      console.log('CheckAuth - Headers:', req.headers.authorization);
      console.log('CheckAuth - Cookies:', req.cookies);
      const token =
        (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
          ? req.headers.authorization.split(' ')[1]
          : null) || req.cookies.accessToken;
  
      if (!token) {
        console.log('CheckAuth - No token found');
        return res.status(401).json({
          success: false,
          message: 'Not authenticated',
        });
      }
  
      console.log('CheckAuth - Verifying token:', token.substring(0, 20) + '...');
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('CheckAuth - User:', decoded.id);
      res.status(200).json({
        success: true,
        user: {
          id: decoded.id,
          email: decoded.email,
        },
      });
    } catch (error) {
      console.error('CheckAuth - Token verification error:', error.message);
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
  };