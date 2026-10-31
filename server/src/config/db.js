import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
export async function connectDB() {
    mongoose.connection.on('connected', () => {
        logger.info({ msg: 'MongoDB connected successfully' });
    });
    mongoose.connection.on('error', (err) => {
        logger.error({ msg: 'MongoDB connection error', error: err.message });
    });
    mongoose.connection.on('disconnected', () => {
        logger.warn({ msg: 'MongoDB disconnected' });
    });
    return mongoose.connect(env.MONGODB_URI, {
        autoIndex: true,
        serverSelectionTimeoutMS: 5000
    });
}
export async function disconnectDB() {
    await mongoose.disconnect();
}
