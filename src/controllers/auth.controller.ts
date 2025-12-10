import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

// -------------------- Zod Schemas --------------------
const registerSchema = z.object({
    name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be less than 50 characters'),
    email: z.string()
        .email('Invalid email format')
        .max(100, 'Email must be less than 100 characters'),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(50, 'Password must be less than 50 characters')
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
        ),
});

const loginSchema = z.object({
    email: z.string()
        .email('Invalid email format')
        .max(100, 'Email must be less than 100 characters'),
    password: z.string()
        .min(1, 'Password is required')
        .max(50, 'Password must be less than 50 characters'),
});

// Interface for registration request
interface RegisterRequest {
    name: string;
    email: string;
    passwordHash: string;
}

// Interface for login response
// types/index.ts
export interface UserData {
    id: string;
    name?: string; // Make optional
    email: string;
    role?: string;
}

export interface LoginResponse {
    token: string;
    user: UserData;
}

// Custom error type for authentication errors
interface AuthError extends Error {
    statusCode?: number;
    code?: string;
}


// -------------------- Register --------------------
export const register = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Validate request body
        const validationResult = registerSchema.safeParse(req.body);

        if (!validationResult.success) {
            const tree = z.treeifyError(validationResult.error);

            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: tree
            });
        }

        const { name, email, password } = validationResult.data;

        const registerRequest: RegisterRequest = {
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

    } catch (error: unknown) {
        console.error('Registration error:', error);

        if (error instanceof Error) {
            const authError = error as AuthError;

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

// -------------------- Login --------------------
export const login = async (req: Request, res: Response): Promise<Response> => {
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

        const loginResponse: LoginResponse = await authService.loginUser(email, password);

        return res.status(200).json({
            success: true,
            data: {
                token: loginResponse.token,
                user: loginResponse.user
            },
            message: 'Login successful'
        });

    } catch (error: unknown) {
        console.error('Login error:', error);

        if (error instanceof Error) {
            const authError = error as AuthError;

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

// -------------------- Additional Authentication Endpoints --------------------

// Optional: Logout endpoint (if using token blacklist)
export const logout = async (req: Request, res: Response): Promise<Response> => {
    try {
        // If using token blacklist, you would invalidate the token here
        // For JWT with no server-side state, client just discards the token

        return res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error: unknown) {
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

// Optional: Get current user profile
export const getProfile = async (req: Request, res: Response): Promise<Response> => {
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

    } catch (error: unknown) {
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