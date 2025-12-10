"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.logout = exports.login = exports.register = void 0;
const zod_1 = require("zod");
const auth_service_1 = require("../services/auth.service");
const authService = new auth_service_1.AuthService();
// -------------------- Zod Schemas --------------------
const registerSchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be less than 50 characters'),
    email: zod_1.z.string()
        .email('Invalid email format')
        .max(100, 'Email must be less than 100 characters'),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(50, 'Password must be less than 50 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string()
        .email('Invalid email format')
        .max(100, 'Email must be less than 100 characters'),
    password: zod_1.z.string()
        .min(1, 'Password is required')
        .max(50, 'Password must be less than 50 characters'),
});
// -------------------- Register --------------------
const register = async (req, res) => {
    try {
        // Validate request body
        const validationResult = registerSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationResult.error
            });
        }
        const { name, email, password } = validationResult.data;
        const registerRequest = {
            name,
            email,
            passwordHash: password, // Note: You might want to hash this in the controller or service
        };
        const user = await authService.registerUser(registerRequest);
        // Remove sensitive information from response
        const { passwordHash, ...userWithoutPassword } = user;
        return res.status(201).json({
            success: true,
            data: userWithoutPassword,
            message: 'User registered successfully'
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        if (error instanceof Error) {
            const authError = error;
            // Handle duplicate email error (common in MongoDB)
            if (authError.message.includes('duplicate')) {
                return res.status(409).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
            return res.status(authError.statusCode || 400).json({
                success: false,
                message: authError.message || 'Registration failed'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Unknown error occurred during registration'
        });
    }
};
exports.register = register;
// -------------------- Login --------------------
const login = async (req, res) => {
    try {
        // Validate request body
        const validationResult = loginSchema.safeParse(req.body);
        if (!validationResult.success) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationResult.error
            });
        }
        const { email, password } = validationResult.data;
        const loginResponse = await authService.loginUser(email, password);
        return res.status(200).json({
            success: true,
            data: {
                token: loginResponse.token,
                user: loginResponse.user
            },
            message: 'Login successful'
        });
    }
    catch (error) {
        console.error('Login error:', error);
        if (error instanceof Error) {
            const authError = error;
            // Specific error messages for authentication failures
            if (authError.message.includes('Invalid credentials') ||
                authError.message.includes('User not found') ||
                authError.message.includes('Incorrect password')) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }
            return res.status(authError.statusCode || 401).json({
                success: false,
                message: authError.message || 'Authentication failed'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Unknown error occurred during login'
        });
    }
};
exports.login = login;
// -------------------- Additional Authentication Endpoints --------------------
// Optional: Logout endpoint (if using token blacklist)
const logout = async (req, res) => {
    try {
        // If using token blacklist, you would invalidate the token here
        // For JWT with no server-side state, client just discards the token
        return res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        if (error instanceof Error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Logout failed'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Unknown error occurred during logout'
        });
    }
};
exports.logout = logout;
// Optional: Get current user profile
const getProfile = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }
        // Remove sensitive information
        const { passwordHash, ...userProfile } = user;
        return res.status(200).json({
            success: true,
            data: userProfile
        });
    }
    catch (error) {
        console.error('Get profile error:', error);
        if (error instanceof Error) {
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch profile'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Unknown error occurred while fetching profile'
        });
    }
};
exports.getProfile = getProfile;
