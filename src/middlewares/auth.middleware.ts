// import { Request, Response, NextFunction } from 'express';
// import jwt from 'jsonwebtoken';
// import { User, JwtPayload } from '../types/index'; // Import both types
// import config from '../config/index';

// export const authMiddleware = async (
//   req: Request, 
//   res: Response, 
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     // Get token from Authorization header
//     const authHeader = req.headers.authorization;
    
//     if (!authHeader) {
//       res.status(401).json({ 
//         success: false,
//         message: 'No authorization header provided' 
//       });
//       return;
//     }

//     // Check Bearer token format
//     if (!authHeader.startsWith('Bearer ')) {
//       res.status(401).json({ 
//         success: false,
//         message: 'Invalid token format. Use: Bearer <token>' 
//       });
//       return;
//     }

//     // Extract token
//     const token = authHeader.split(' ')[1];
    
//     if (!token || token.trim() === '') {
//       res.status(401).json({ 
//         success: false,
//         message: 'Token is missing' 
//       });
//       return;
//     }

//     // Verify token
//     const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

//     // Validate decoded token structure
//     if (!decoded.id || !decoded.email || !decoded.role) {
//       res.status(401).json({ 
//         success: false,
//         message: 'Invalid token payload' 
//       });
//       return;
//     }

//     // Attach user to request object - properly typed
//     req.user = {
//       id: decoded.id,
//       email: decoded.email,
//       role: decoded.role,
//       name: decoded.name,
//       permissions: decoded.permissions // Now this exists
//     } as User;

//     next();
//   } catch (error) {
//     console.error('Auth middleware error:', error);
    
//     if (error instanceof jwt.JsonWebTokenError) {
//       res.status(401).json({ 
//         success: false,
//         message: 'Invalid token',
//         error: error.message 
//       });
//       return;
//     }
    
//     if (error instanceof jwt.TokenExpiredError) {
//       res.status(401).json({ 
//         success: false,
//         message: 'Token has expired',
//         error: 'Token expired'  
//       });
//       return;
//     }

//     res.status(500).json({ 
//       success: false,
//       message: 'Authentication failed',
//       error: 'Internal server error' 
//     });
//   }
// };

// // Optional: Create a separate middleware for permissions
// export const checkPermissions = (requiredPermissions: string[]) => {
//   return (req: Request, res: Response, next: NextFunction): void => {
//     if (!req.user) {
//       res.status(401).json({ 
//         success: false,
//         message: 'Authentication required' 
//       });
//       return;
//     }

//     // Check if user has permissions property
//     if (!req.user.permissions) {
//       res.status(403).json({ 
//         success: false,
//         message: 'No permissions assigned' 
//       });
//       return;
//     }

//     // Check if user has all required permissions
//     const hasAllPermissions = requiredPermissions.every(permission =>
//       req.user!.permissions!.includes(permission)
//     );

//     if (!hasAllPermissions) {
//       res.status(403).json({ 
//         success: false,
//         message: `Missing required permissions: ${requiredPermissions.join(', ')}`
//       });
//       return;
//     }

//     next();
//   };
// };

// // Role check middleware (simplified version)
// export const requireRole = (...roles: string[]) => {
//   return (req: Request, res: Response, next: NextFunction): void => {
//     if (!req.user) {
//       res.status(401).json({ 
//         success: false,
//         message: 'Authentication required' 
//       });
//       return;
//     }

//     if (!roles.includes(req.user.role)) {
//       res.status(403).json({ 
//         success: false,
//         message: `Access denied. Required roles: ${roles.join(', ')}`,
//         userRole: req.user.role 
//       });
//       return;
//     }

//     next();
//   };
// };

// // Admin middleware (for convenience)
// export const adminMiddleware = requireRole('admin');

// // User or admin middleware
// export const userOrAdminMiddleware = requireRole('user', 'admin');


import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, JwtPayload } from '../types/index';
import config from '../config/index';

export const authMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
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
    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

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
      name: decoded.name ?? null,   // optional
      permissions: decoded.permissions ?? [] // optional
    } as User;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ 
        success: false,
        message: 'Invalid token',
        error: error.message 
      });
      return;
    }
    
    if (error instanceof jwt.TokenExpiredError) {
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

// ------------------------------
// Permissions Middleware
// ------------------------------
export const checkPermissions = (requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const userPermissions = req.user.permissions ?? [];

    const hasAllPermissions = requiredPermissions.every(permission =>
      userPermissions.includes(permission)
    );

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

// ------------------------------
// Role Middleware
// ------------------------------
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
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

// Convenience middlewares
export const adminMiddleware = requireRole('admin');
export const userOrAdminMiddleware = requireRole('user', 'admin');
export const userMiddleware = requireRole('user');
