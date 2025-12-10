import express, { Application, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createServer, Server as HTTPServer } from 'http';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/auth.routes';
import bookingRoutes from './routes/bookings.routes';
import roomRoutes from './routes/rooms.routes';

// Import types
import { ApiResponse, Booking} from './types/index';

// Load environment variables
dotenv.config();

// -------------------- Type Definitions --------------------
interface ProcessEnv {
  PORT?: string;
  NODE_ENV?: string;
  MONGODB_URI?: string;
  CORS_ORIGIN?: string;
  JWT_SECRET?: string;
}

interface MongoError extends Error {
  code?: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
}

interface CastError extends Error {
  path?: string;
  value?: unknown;
  kind?: string;
}

interface JwtError extends Error {
  expiredAt?: Date;
}

interface ExtendedRequest extends Request {
  io?: Server;
}

// -------------------- App Configuration --------------------
const app: Application = express();
const PORT: number = parseInt(process.env.PORT || '5000', 10);
const NODE_ENV: string = process.env.NODE_ENV || 'development';

// Create HTTP server (for Socket.io)
const httpServer: HTTPServer = createServer(app);

// Initialize Socket.io (optional, for real-time features)
const io: Server = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  pingTimeout: 60000
});

// Store for real-time room availability
const activeBookings = new Map<string, Booking>();

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  // Join room for specific room updates
  socket.on('join-room', (roomId: string) => {
    socket.join(`room-${roomId}`);
    console.log(`Client ${socket.id} joined room-${roomId}`);
  });

  // Leave room
  socket.on('leave-room', (roomId: string) => {
    socket.leave(`room-${roomId}`);
    console.log(`Client ${socket.id} left room-${roomId}`);
  });

  // Handle booking creation updates
  socket.on('booking-created', (bookingData: Booking) => {
    const { roomId } = bookingData;
    io.to(`room-${roomId}`).emit('booking-updated', {
      type: 'created',
      booking: bookingData,
      timestamp: new Date().toISOString()
    });
  });

  // Handle booking cancellation updates
  socket.on('booking-cancelled', (bookingData: Booking) => {
    const { roomId } = bookingData;
    io.to(`room-${roomId}`).emit('booking-updated', {
      type: 'cancelled',
      booking: bookingData,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Make Socket.io available in routes (optional)
app.set('io', io);

// -------------------- Security Middleware --------------------

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',') 
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: NODE_ENV === 'production' ? 100 : 1000, // Limit each IP
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

// -------------------- Application Middleware --------------------

// Request logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  // Create a write stream for production logs
  const accessLogStream = fs.createWriteStream(
    path.join(logsDir, 'access.log'),
    { flags: 'a' }
  );
  app.use(morgan('combined', { stream: accessLogStream }));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Static files (if you have any)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// -------------------- Database Connection --------------------

const MONGODB_URI: string = process.env.MONGODB_URI || 'mongodb://localhost:27017/booking-system';

mongoose.set('strictQuery', true);

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB Connected Successfully');
    
    // Check connection status
    mongoose.connection.on('connected', () => {
      console.log('📊 MongoDB Connection Status: Connected');
    });
    
    mongoose.connection.on('error', (err: Error) => {
      console.error('❌ MongoDB Connection Error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB Disconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });
    
  } catch (error: unknown) {
    console.error('❌ MongoDB Connection Failed:', error);
    process.exit(1);
  }
};

// -------------------- Health Check & Monitoring --------------------

app.get('/health', (req: Request, res: Response) => {
  const healthcheck: ApiResponse = {
    success: true,
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      environment: NODE_ENV
    },
    message: 'Server is running healthy'
  };
  res.status(200).json(healthcheck);
});

app.get('/status', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      service: 'Booking System API',
      version: '1.0.0',
      status: 'operational',
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
      endpoints: [
        { path: '/api/auth', methods: ['POST', 'GET'] },
        { path: '/api/users', methods: ['GET', 'PUT'] },
        { path: '/api/bookings', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
        { path: '/api/rooms', methods: ['GET', 'POST', 'PUT', 'DELETE'] }
      ]
    }
  });
});

// -------------------- API Routes --------------------

// Welcome route
app.get('/api', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Booking System API',
    version: '1.0.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      bookings: '/api/bookings',
      rooms: '/api/rooms'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/rooms', roomRoutes);

// -------------------- Error Handling Middleware --------------------

// 404 Handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: 'Not Found'
  });
});

// Global error handler
app.use((error: Error, req: ExtendedRequest, res: Response, next: NextFunction) => {
  console.error('🚨 Global Error Handler:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Mongoose validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      error: error.message
    });
  }

  // MongoDB duplicate key errors
  if (error.name === 'MongoError') {
    const mongoError = error as MongoError;
    if (mongoError.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate key error',
        error: 'A record with this value already exists'
      });
    }
  }

  // Mongoose cast errors
  if (error.name === 'CastError') {
    const castError = error as CastError;
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      error: `The provided value "${castError.value}" is not valid for ${castError.path}`
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: 'Authentication failed'
    });
  }

  if (error.name === 'TokenExpiredError') {
    const jwtError = error as JwtError;
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      error: `Token expired at ${jwtError.expiredAt?.toISOString() || 'unknown time'}. Please login again.`
    });
  }

  // Custom error with status code
  interface CustomError extends Error {
    statusCode?: number;
  }
  
  const customError = error as CustomError;
  const statusCode = customError.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message: NODE_ENV === 'production' ? 'Something went wrong' : message,
    ...(NODE_ENV === 'development' && { 
      error: error.stack,
      details: {
        name: error.name,
        message: error.message
      }
    })
  });
});

// -------------------- Graceful Shutdown --------------------

const gracefulShutdown = (signal: string): void => {
  console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);
  
  // Close HTTP server
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    
    // Close database connection
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      console.log('👋 Graceful shutdown complete');
      process.exit(0);
    });
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('❌ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// -------------------- Start Server --------------------

const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDB();
    
    // Start server
    httpServer.listen(PORT, () => {
      console.log(`
🚀 Server is running!
──────────────────────────────────
🌍 Environment: ${NODE_ENV}
📡 Port: ${PORT}
🔗 Health Check: http://localhost:${PORT}/health
📊 Status: http://localhost:${PORT}/status
📁 API Base: http://localhost:${PORT}/api
──────────────────────────────────
      `);
      
      // Log active middleware
      console.log('✅ Active Middleware:');
      console.log('   ✓ Helmet (Security Headers)');
      console.log('   ✓ CORS');
      console.log('   ✓ Rate Limiting');
      console.log('   ✓ Body Parser');
      console.log('   ✓ Compression');
      console.log('   ✓ Request Logging');
      
      // Log database connection
      console.log('\n🗄️  Database:');
      console.log(`   ✓ Connected to: ${mongoose.connection.name}`);
      console.log(`   ✓ Host: ${mongoose.connection.host}`);
      const modelNames = Object.keys(mongoose.connection.models);
      console.log(`   ✓ Models: ${modelNames.length > 0 ? modelNames.join(', ') : 'None'}`);
      
      // Log available routes
      console.log('\n📡 Available Routes:');
      console.log('   ✓ GET  /health');
      console.log('   ✓ GET  /status');
      console.log('   ✓ GET  /api');
      console.log('   ✓ POST /api/auth/login');
      console.log('   ✓ POST /api/auth/register');
      console.log('   ✓ GET  /api/bookings');
      console.log('   ✓ POST /api/bookings');
      console.log('   ✓ GET  /api/rooms');
      console.log('   ✓ GET  /api/rooms/availability');
    });
    
  } catch (error: unknown) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Export for testing
export { app, httpServer, io };