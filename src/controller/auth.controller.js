import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import passport from '../config/passport.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const login = (req, res, next) => {
  // Validate JWT_SECRET
  if (!JWT_SECRET) {
    console.error('JWT_SECRET is not defined');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error',
    });
  }

  passport.authenticate('local', { session: false }, (err, user, info) => {
    try {
      if (err) {
        console.error('Login error:', err);
        return res.status(500).json({
          success: false,
          message: 'Server error',
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: info?.message || 'Invalid credentials',
        });
      }

      const token = jwt.sign(
        { id: user._id, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none', // Required for cross-origin cookies
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      };

      console.log('Login - Setting accessToken cookie:', {
        token: token.substring(0, 20) + '...',
        options,
      });

      res.cookie('accesstoken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

       res
        .status(200)
        // .cookie('accessToken', token, options)
        .json({
          success: true,
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
          },
        });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error',
      });
    }
  })(req, res, next);
};

export const register = async (req, res) => {
  try {
    // Validate JWT_SECRET
    if (!JWT_SECRET) {
      console.error('JWT_SECRET is not defined');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none', // Align with login for cross-origin
      maxAge: 24 * 60 * 60 * 1000, // 24 hours to match token expiry
      path: '/',
    };

    console.log('Register - Setting accessToken cookie:', {
      token: token.substring(0, 20) + '...',
      options,
    });

    return res
      .status(201)
      .cookie('accessToken', token, options)
      .json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

