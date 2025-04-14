import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
export const authenticate = (req, res, next) => {
  try {
    // Validate JWT_SECRET
    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not defined');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    console.log('Authenticate - Cookies:', req.cookies);
    const token = req.cookies.accesstoken;
    console.log(req);
    
    console.log(token);
    

    if (!token) {
      console.log('Authenticate - No accessToken cookie found');
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    console.log('Authenticate - Verifying token:', token.substring(0, 20) + '...');
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    console.log('Authenticate - User:', decoded.id);
    next();
  } catch (error) {
    console.error('Authenticate - Token verification error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};