"use strict";
// import { Request, Response, NextFunction } from 'express';
// import jwt from 'jsonwebtoken';
// import { User, JwtPayload } from '../types/index'; // Import both types
// import config from '../config/index';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userMiddleware = exports.userOrAdminMiddleware = exports.adminMiddleware = exports.requireRole = exports.checkPermissions = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = __importDefault(require("../config/index"));
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({
                success: false,
                message: 'No authorization header provided'
            });
            return;
        }
        if (!authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Invalid token format. Use: Bearer <token>'
            });
            return;
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Token is missing'
            });
            return;
        }
        // Decode JWT
        const decoded = jsonwebtoken_1.default.verify(token, index_1.default.JWT_SECRET);
        // Only require id & role since your token only contains these.
        if (!decoded.id || !decoded.role) {
            res.status(401).json({
                success: false,
                message: 'Invalid token payload'
            });
            return;
        }
        // Attach user to request
        req.user = {
            id: decoded.id,
            role: decoded.role,
            email: decoded.email ?? null, // optional
            name: decoded.name ?? null, // optional
            permissions: decoded.permissions ?? [] // optional
        };
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                message: 'Invalid token',
                error: error.message
            });
            return;
        }
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                success: false,
                message: 'Token has expired'
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: 'Authentication failed'
        });
    }
};
exports.authMiddleware = authMiddleware;
// ------------------------------
// Permissions Middleware
// ------------------------------
const checkPermissions = (requiredPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }
        const userPermissions = req.user.permissions ?? [];
        const hasAllPermissions = requiredPermissions.every(permission => userPermissions.includes(permission));
        if (!hasAllPermissions) {
            res.status(403).json({
                success: false,
                message: `Missing required permissions: ${requiredPermissions.join(', ')}`
            });
            return;
        }
        next();
    };
};
exports.checkPermissions = checkPermissions;
// ------------------------------
// Role Middleware
// ------------------------------
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: `Access denied. Required roles: ${roles.join(', ')}`,
                userRole: req.user.role
            });
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
// Convenience middlewares
exports.adminMiddleware = (0, exports.requireRole)('admin');
exports.userOrAdminMiddleware = (0, exports.requireRole)('user', 'admin');
exports.userMiddleware = (0, exports.requireRole)('user');
