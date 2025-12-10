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
import { createServer } from 'http';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/auth.routes';
import bookingRoutes from './routes/bookings.routes';
import roomRoutes from './routes/rooms.routes';

// Import types
import { ApiResponse, Booking } from './types/index';

// Load environment variables
dotenv.config();

// Create Express app
const app: Application = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server (for Socket.io)
const httpServer = createServer(app);

// Initialize Socket.io (optional, for real-time features)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  pingTimeout: 60000
});

// Store for real-time room availability
const activeBookings = new Map();

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

// ====================
// SECURITY MIDDLEWARE
// ====================

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
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

// ====================
// APPLICATION MIDDLEWARE
// ====================

// Request logging
if (NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Create a write stream for production logs
  const accessLogStream = fs.createWriteStream(
    path.join(__dirname, 'logs', 'access.log'),
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

// ====================
// DATABASE CONNECTION
// ====================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/booking-system';

mongoose.set('strictQuery', true);

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB Connected Successfully');
    
    // Check connection status
    mongoose.connection.on('connected', () => {
      console.log('📊 MongoDB Connection Status: Connected');
    });
    
    mongoose.connection.on('error', (err) => {
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
    
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error);
    process.exit(1);
  }
};

// ====================
// HEALTH CHECK & MONITORING
// ====================

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

// ====================
// API ROUTES
// ====================

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

// ====================
// ERROR HANDLING MIDDLEWARE
// ====================

// 404 Handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    error: 'Not Found'
  });
});

// Global error handler
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('🚨 Global Error Handler:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Mongoose errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      error: error.message
    });
  }

  if (error.name === 'MongoError' && (error as any).code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate key error',
      error: 'A record with this value already exists'
    });
  }

  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      error: 'The provided ID is not valid'
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
    return res.status(401).json({
      success: false,
      message: 'Token expired',
      error: 'Please login again'
    });
  }

  // Default error response
  const statusCode = (error as any).statusCode || 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message: NODE_ENV === 'production' ? 'Something went wrong' : message,
    error: NODE_ENV === 'development' ? error.stack : undefined,
    ...(NODE_ENV === 'development' && { 
      details: {
        name: error.name,
        message: error.message
      }
    })
  });
});

// ====================
// GRACEFUL SHUTDOWN
// ====================

const gracefulShutdown = (signal: string) => {
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

// ====================
// START SERVER
// ====================

const startServer = async () => {
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
      console.log(`   ✓ Models: ${Object.keys(mongoose.connection.models).join(', ')}`);
      
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
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Export for testing
export { app, httpServer, io };