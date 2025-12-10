import dotenv from 'dotenv';

dotenv.config();

interface Config {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  BCRYPT_SALT_ROUNDS: number;
  CORS_ORIGIN: string;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
}

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGODB_URI'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Environment variable ${varName} is required`);
  }
});

const config: Config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
};

export default config;

// WToFUGTaHJggaGPG
// sagarpatelanumala7522_db_user
// mongodb+srv://sagarpatelanumala7522_db_user:WToFUGTaHJggaGPG@cluster0.lejrm5q.mongodb.net/?appName=Cluster0