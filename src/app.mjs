import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import linkedinRoutes from './routes/linkedin.routes.mjs';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/linkedin', linkedinRoutes); // base route

export default app;
