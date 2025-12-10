import { Request, Response } from 'express';
import {
  createBooking as createBookingService,
  rescheduleBooking as rescheduleBookingService,
  getBookingsByUserId,
  getAllBookings,
  getBookingById,
  getBookingsForRoom,
  cancelBooking as cancelBookingService,
  getBookingsByRoomId,
  checkRoomAvailability,
} from '../services/booking.service';

// ---------------------------
// Create Booking
// ---------------------------
export const createBooking = async (req: Request, res: Response) => {
  try {
    const { roomId, startTime, endTime } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const booking = await createBookingService(
      { roomId, startTime: new Date(startTime), endTime: new Date(endTime) },
      userId
    );

    return res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully'
    });

  } catch (error: any) {
    console.error('Create booking error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to create booking' 
    });
  }
};

// ---------------------------
// Reschedule Booking
// ---------------------------
export const rescheduleBooking = async (req: Request, res: Response) => {
  try {
    const bookingId = req.params.id;
    const { startTime, endTime } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const updatedBooking = await rescheduleBookingService(
      bookingId,
      { startTime: new Date(startTime), endTime: new Date(endTime) },
      userId
    );

    return res.status(200).json({
      success: true,
      data: updatedBooking,
      message: 'Booking rescheduled successfully'
    });

  } catch (error: any) {
    console.error('Reschedule booking error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to reschedule booking' 
    });
  }
};

// ---------------------------
// List Bookings for Current User
// ---------------------------
export const listUserBookings = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { status, limit, page } = req.query;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const options = {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      page: page ? parseInt(page as string) : undefined
    };

    const bookings = await getBookingsByUserId(userId, options);

    return res.status(200).json({
      success: true,
      data: bookings,
      count: bookings.length
    });

  } catch (error: any) {
    console.error('List user bookings error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to fetch bookings' 
    });
  }
};

// ---------------------------
// Admin: List All Bookings
// ---------------------------
export const listAllBookings = async (req: Request, res: Response) => {
  try {
    const { status, fromDate, toDate, limit, page } = req.query;

    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const options = {
      status: status as string,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      page: page ? parseInt(page as string) : undefined
    };

    const bookings = await getAllBookings(options);

    return res.status(200).json({
      success: true,
      data: bookings,
      count: bookings.length
    });

  } catch (error: any) {
    console.error('List all bookings error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to fetch bookings' 
    });
  }
};

// ---------------------------
// Admin: List All Bookings Grouped by Room
// ---------------------------
export const listAllBookingsGroupedByRoom = async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    const { fromDate, toDate } = req.query;

    const options = {
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      status: 'confirmed'
    };

    const bookings = await getAllBookings(options);

    // Group by room
    const grouped = bookings.reduce((acc: any, booking: any) => {
      const roomId = booking.roomId._id.toString();
      
      if (!acc[roomId]) {
        acc[roomId] = {
          room: {
            id: booking.roomId._id,
            name: booking.roomId.name,
            capacity: booking.roomId.capacity
          },
          bookings: [],
        };
      }

      acc[roomId].bookings.push({
        id: booking._id,
        user: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status
      });
      
      return acc;

    }, {});

    return res.status(200).json({
      success: true,
      data: Object.values(grouped)
    });

  } catch (error: any) {
    console.error('List grouped bookings error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to fetch bookings' 
    });
  }
};

// ---------------------------
// Cancel Booking
// ---------------------------
export const cancelUserBooking = async (req: Request, res: Response) => {
  try {
    const bookingId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const cancelledBooking = await cancelBookingService(bookingId, userId);

    return res.status(200).json({
      success: true,
      data: cancelledBooking,
      message: 'Booking cancelled successfully'
    });

  } catch (error: any) {
    console.error('Cancel booking error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to cancel booking' 
    });
  }
};

// ---------------------------
// List Bookings by Room
// ---------------------------
export const getRoomBookings = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId;
    const { fromDate, toDate, status, limit, page } = req.query;

    const options = {
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
      page: page ? parseInt(page as string) : undefined
    };

    const bookings = await getBookingsByRoomId(roomId, options);

    return res.status(200).json({
      success: true,
      data: bookings,
      count: bookings.length
    });

  } catch (error: any) {
    console.error('Get room bookings error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to fetch room bookings' 
    });
  }
};

// ---------------------------
// Get Bookings for Room on Specific Date
// ---------------------------
export const getBookingsForRoomByDate = async (req: Request, res: Response) => {
  try {
    const roomId = req.params.roomId;
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Date parameter is required' 
      });
    }

    const bookings = await getBookingsForRoom(roomId, date);

    return res.status(200).json({
      success: true,
      data: bookings,
      date: date,
      count: bookings.length
    });

  } catch (error: any) {
    console.error('Get bookings for room by date error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to fetch bookings' 
    });
  }
};

// ---------------------------
// Single Booking by ID
// ---------------------------
export const getBooking = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const booking = await getBookingById(id);

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    // Check if user is authorized to view this booking
    const userId = req.user?.id;
    const isOwner = booking.userId.toString() === userId;
    const isAdmin = req.user?.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to view this booking' 
      });
    }

    return res.status(200).json({
      success: true,
      data: booking
    });

  } catch (error: any) {
    console.error('Get booking error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to fetch booking' 
    });
  }
};

// ---------------------------
// Check Room Availability
// ---------------------------
export const checkAvailability = async (req: Request, res: Response) => {
  try {
    const { roomId, startTime, endTime, excludeBookingId } = req.body;

    if (!roomId || !startTime || !endTime) {
      return res.status(400).json({ 
        success: false, 
        message: 'roomId, startTime, and endTime are required' 
      });
    }

    const isAvailable = await checkRoomAvailability(
      roomId,
      new Date(startTime),
      new Date(endTime),
      excludeBookingId
    );

    return res.status(200).json({
      success: true,
      data: {
        isAvailable,
        roomId,
        requestedStartTime: startTime,
        requestedEndTime: endTime
      }
    });

  } catch (error: any) {
    console.error('Check availability error:', error);
    return res.status(400).json({ 
      success: false, 
      message: error.message || 'Failed to check availability' 
    });
  }
};