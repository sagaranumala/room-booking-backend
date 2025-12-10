"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookings_controller_1 = require("../controllers/bookings.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authMiddleware);
// User routes
router.post('/', bookings_controller_1.createBooking);
router.get('/me', bookings_controller_1.listUserBookings);
router.get('/:id', bookings_controller_1.getBooking);
router.patch('/:id/reschedule', bookings_controller_1.rescheduleBooking);
router.delete('/:id/cancel', bookings_controller_1.cancelUserBooking);
// Room-specific routes
router.get('/room/:roomId', bookings_controller_1.getRoomBookings);
router.get('/room/:roomId/date', bookings_controller_1.getBookingsForRoomByDate);
router.post('/check-availability', bookings_controller_1.checkAvailability);
// Admin routes
router.get('/admin/all', auth_middleware_1.adminMiddleware, bookings_controller_1.listAllBookings);
router.get('/admin/grouped-by-room', role_middleware_1.roleMiddleware, bookings_controller_1.listAllBookingsGroupedByRoom);
exports.default = router;
