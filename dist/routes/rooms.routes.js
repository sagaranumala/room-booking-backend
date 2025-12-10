"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rooms_controller_1 = require("../controllers/rooms.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
// Public routes (no authentication required)
router.get('/', rooms_controller_1.getAllRooms);
router.get('/availability', rooms_controller_1.checkAvailability);
router.get("/allroomsavailability", rooms_controller_1.getRoomAvailabilityByDate);
router.get('/availabilityslots', rooms_controller_1.getRoomAvailabilityBySlots);
router.get('/:id', rooms_controller_1.getRoomById);
router.get('/:roomId/bookings', rooms_controller_1.getRoomBookings);
// Protected routes (admin only)
router.post('/', auth_middleware_1.authMiddleware, role_middleware_1.adminMiddleware, rooms_controller_1.createRoom);
router.put('/:id', auth_middleware_1.authMiddleware, role_middleware_1.adminMiddleware, rooms_controller_1.updateRoom);
router.patch("/:id/deactivate", auth_middleware_1.authMiddleware, role_middleware_1.adminMiddleware, rooms_controller_1.deactivateRoom);
router.patch("/:id/activate", auth_middleware_1.authMiddleware, role_middleware_1.adminMiddleware, rooms_controller_1.activateRoom);
router.delete("/:id/permanent", auth_middleware_1.authMiddleware, role_middleware_1.adminMiddleware, rooms_controller_1.deleteRoomPermanent);
exports.default = router;
