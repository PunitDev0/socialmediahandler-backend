import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from 'passport';
import linkedinRoutes from './routes/linkedin.routes.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import './config/passport.js'; // Initialize passport strategy
import connectDB from './DB/DB_Connection.js';
import cookieParser from 'cookie-parser';
import linkedinShdedule from  './routes/sheduling/linkedinshedule.routes.js'
import { startCronJobs } from './config/cron.js';  // <-- Update the path accordingly
dotenv.config();
connectDB();

const app = express();

// CORS configuration
app.use(
  cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(passport.initialize()); // Only initialize passport, no session

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/linkedin', linkedinRoutes);
app.use('/api/user', userRoutes);
app.use('/post/linkedin', linkedinShdedule);
startCronJobs(); // <-- This will run the cron scheduler

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: err.message,
  });
});

export default app; 