"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOrUserMiddleware = exports.userMiddleware = exports.adminMiddleware = exports.roleMiddleware = void 0;
const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
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
        }
        catch (error) {
            console.error('Role middleware error:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error in role validation'
            });
        }
    };
};
exports.roleMiddleware = roleMiddleware;
// Convenience middleware for specific roles
exports.adminMiddleware = (0, exports.roleMiddleware)('admin');
exports.userMiddleware = (0, exports.roleMiddleware)('user');
exports.adminOrUserMiddleware = (0, exports.roleMiddleware)(['admin', 'user']);
