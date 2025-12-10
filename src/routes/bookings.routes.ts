import { Router } from 'express';
import {
  createBooking,
  rescheduleBooking,
  listUserBookings,
  listAllBookings,
  listAllBookingsGroupedByRoom,
  cancelUserBooking,
  getRoomBookings,
  getBooking,
  getBookingsForRoomByDate,
  checkAvailability,
} from '../controllers/bookings.controller';
import { adminMiddleware, authMiddleware } from '../middlewares/auth.middleware';
import { roleMiddleware } from '../middlewares/role.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// User routes
router.post('/', createBooking);
router.get('/me', listUserBookings);
router.get('/:id', getBooking);
router.patch('/:id/reschedule', rescheduleBooking);
router.delete('/:id/cancel', cancelUserBooking);

// Room-specific routes
router.get('/room/:roomId', getRoomBookings);
router.get('/room/:roomId/date', getBookingsForRoomByDate);
router.post('/check-availability', checkAvailability);

// Admin routes
router.get('/admin/all', adminMiddleware, listAllBookings);
router.get('/admin/grouped-by-room', roleMiddleware, listAllBookingsGroupedByRoom);

export default router;