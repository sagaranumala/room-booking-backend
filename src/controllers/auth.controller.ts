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
      'Password must contain an uppercase letter, lowercase letter, number, and special character'
    )
});

const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .max(100, 'Email must be less than 100 characters'),
  password: z.string()
    .min(1, 'Password is required')
    .max(50, 'Password must be less than 50 characters'),
});

// -------------------- Register --------------------
export const register = async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};

      result.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: fieldErrors,
      });
    }

    const { name, email, password } = result.data;

    const user = await authService.registerUser({
      name,
      email,
      passwordHash: password,
    });

    const { passwordHash, ...userWithoutPassword } = user;

    return res.status(201).json({
      success: true,
      data: userWithoutPassword,
      message: 'User registered successfully',
    });

  } catch (error: any) {

    if (error.message?.includes('duplicate')) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Registration failed',
    });
  }
};

// -------------------- Login --------------------
export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};

      result.error.issues.forEach((issue) => {
        fieldErrors[issue.path[0] as string] = issue.message;
      });

      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: fieldErrors,
      });
    }

    const { email, password } = result.data;

    const loginResponse = await authService.loginUser(email, password);

    return res.status(200).json({
      success: true,
      data: {
        token: loginResponse.token,
        user: loginResponse.user,
      },
      message: 'Login successful',
    });

  } catch (error: any) {

    if (
      error.message?.includes('Invalid credentials') ||
      error.message?.includes('User not found') ||
      error.message?.includes('Incorrect password')
    ) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || 'Authentication failed',
    });
  }
};

// -------------------- Logout --------------------
export const logout = async (_req: Request, res: Response): Promise<Response> => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

// -------------------- Get Profile --------------------
export const getProfile = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user: any = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const { passwordHash, ...profile } = user;

    return res.status(200).json({
      success: true,
      data: profile,
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch profile',
    });
  }
};
