"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.httpServer = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const http_1 = require("http");
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const auth_routes_2 = __importDefault(require("./routes/auth.routes"));
const bookings_routes_1 = __importDefault(require("./routes/bookings.routes"));
const rooms_routes_1 = __importDefault(require("./routes/rooms.routes"));
// Load environment variables
dotenv_1.default.config();
// Create Express app
const app = (0, express_1.default)();
exports.app = app;
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
// Create HTTP server (for Socket.io)
const httpServer = (0, http_1.createServer)(app);
exports.httpServer = httpServer;
// Initialize Socket.io (optional, for real-time features)
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true
    },
    pingTimeout: 60000
});
exports.io = io;
// Store for real-time room availability
const activeBookings = new Map();
// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    // Join room for specific room updates
    socket.on('join-room', (roomId) => {
        socket.join(`room-${roomId}`);
        console.log(`Client ${socket.id} joined room-${roomId}`);
    });
    // Leave room
    socket.on('leave-room', (roomId) => {
        socket.leave(`room-${roomId}`);
        console.log(`Client ${socket.id} left room-${roomId}`);
    });
    // Handle booking creation updates
    socket.on('booking-created', (bookingData) => {
        const { roomId } = bookingData;
        io.to(`room-${roomId}`).emit('booking-updated', {
            type: 'created',
            booking: bookingData,
            timestamp: new Date().toISOString()
        });
    });
    // Handle booking cancellation updates
    socket.on('booking-cancelled', (bookingData) => {
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
app.use((0, helmet_1.default)({
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
app.use((0, cors_1.default)(corsOptions));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
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
    app.use((0, morgan_1.default)('dev'));
}
else {
    // Create a write stream for production logs
    const accessLogStream = fs_1.default.createWriteStream(path_1.default.join(__dirname, 'logs', 'access.log'), { flags: 'a' });
    app.use((0, morgan_1.default)('combined', { stream: accessLogStream }));
}
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Compression middleware
app.use((0, compression_1.default)());
// Static files (if you have any)
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, 'uploads')));
// ====================
// DATABASE CONNECTION
// ====================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/booking-system';
mongoose_1.default.set('strictQuery', true);
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log('✅ MongoDB Connected Successfully');
        // Check connection status
        mongoose_1.default.connection.on('connected', () => {
            console.log('📊 MongoDB Connection Status: Connected');
        });
        mongoose_1.default.connection.on('error', (err) => {
            console.error('❌ MongoDB Connection Error:', err);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB Disconnected');
        });
        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose_1.default.connection.close();
            console.log('MongoDB connection closed due to app termination');
            process.exit(0);
        });
    }
    catch (error) {
        console.error('❌ MongoDB Connection Failed:', error);
        process.exit(1);
    }
};
// ====================
// HEALTH CHECK & MONITORING
// ====================
app.get('/health', (req, res) => {
    const healthcheck = {
        success: true,
        data: {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            database: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected',
            environment: NODE_ENV
        },
        message: 'Server is running healthy'
    };
    res.status(200).json(healthcheck);
});
app.get('/status', (req, res) => {
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
app.get('/api', (req, res) => {
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
app.use('/api/auth', auth_routes_1.default);
app.use('/api/users', auth_routes_2.default);
app.use('/api/bookings', bookings_routes_1.default);
app.use('/api/rooms', rooms_routes_1.default);
// ====================
// ERROR HANDLING MIDDLEWARE
// ====================
// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`,
        error: 'Not Found'
    });
});
// Global error handler
app.use((error, req, res, next) => {
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
    if (error.name === 'MongoError' && error.code === 11000) {
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
    const statusCode = error.statusCode || 500;
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
const gracefulShutdown = (signal) => {
    console.log(`\n⚠️  Received ${signal}. Starting graceful shutdown...`);
    // Close HTTP server
    httpServer.close(() => {
        console.log('✅ HTTP server closed');
        // Close database connection
        mongoose_1.default.connection.close(false, () => {
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
            console.log(`   ✓ Connected to: ${mongoose_1.default.connection.name}`);
            console.log(`   ✓ Host: ${mongoose_1.default.connection.host}`);
            console.log(`   ✓ Models: ${Object.keys(mongoose_1.default.connection.models).join(', ')}`);
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
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
// Start the server
startServer();
