import { Router } from 'express';
import {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoom,
  deactivateRoom,
  checkAvailability,
  getRoomBookings,
  getRoomAvailabilityByDate,
  getRoomAvailabilityBySlots,
  activateRoom,
  deleteRoomPermanent
} from '../controllers/rooms.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { adminMiddleware } from '../middlewares/role.middleware';

const router = Router();

// Public routes (no authentication required)
router.get('/', getAllRooms);
router.get('/availability', checkAvailability);
router.get("/allroomsavailability", getRoomAvailabilityByDate);
router.get('/availabilityslots', getRoomAvailabilityBySlots);
router.get('/:id', getRoomById);
router.get('/:roomId/bookings', getRoomBookings);

// Protected routes (admin only)
router.post('/', authMiddleware, adminMiddleware, createRoom);
router.put('/:id', authMiddleware, adminMiddleware, updateRoom);
router.patch("/:id/deactivate",authMiddleware, adminMiddleware, deactivateRoom);
router.patch("/:id/activate", authMiddleware, adminMiddleware, activateRoom);
router.delete("/:id/permanent", authMiddleware, adminMiddleware, deleteRoomPermanent);


export default router;