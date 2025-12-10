import { Request, Response, NextFunction } from 'express';


export const roleMiddleware = (allowedRoles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user exists
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Convert allowedRoles to array if it's a string
      const roles = Array.isArray(allowedRoles) 
        ? allowedRoles 
        : [allowedRoles];

      // Check if user has required role
      const userRole = req.user.role;
      const hasPermission = roles.includes(userRole);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required role(s): ${roles.join(', ')}`,
          userRole
        });
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error in role validation'
      });
    }
  };
};

// Convenience middleware for specific roles
export const adminMiddleware = roleMiddleware('admin');
export const userMiddleware = roleMiddleware('user');
export const adminOrUserMiddleware = roleMiddleware(['admin', 'user']);