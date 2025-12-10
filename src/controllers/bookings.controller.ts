import { Request, Response } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
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
import {GroupedBooking }from '../types/index';

// -------------------- Zod Schemas --------------------

const createBookingSchema = z.object({
  roomId: z.string().min(1, "Room ID is required"),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid startTime date format",
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid endTime date format",
  }),
});

const rescheduleBookingSchema = z.object({
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid startTime date format",
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid endTime date format",
  }),
});

const bookingIdSchema = z.object({
  id: z.string().min(1, "Booking ID is required"),
});

const userIdSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

const listUserBookingsSchema = z.object({
  status: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const listAllBookingsSchema = z.object({
  status: z.string().optional(),
  fromDate: z.string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid fromDate format",
    })
    .optional(),
  toDate: z.string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid toDate format",
    })
    .optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const roomIdParamSchema = z.object({
  roomId: z.string().min(1, "Room ID is required"),
});

const getRoomBookingsSchema = z.object({
  fromDate: z.string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid fromDate format",
    })
    .optional(),
  toDate: z.string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Invalid toDate format",
    })
    .optional(),
  status: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const getBookingsForRoomByDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Date must be in YYYY-MM-DD format",
  }),
});

const checkAvailabilitySchema = z.object({
  roomId: z.string().min(1, "Room ID is required"),
  startTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid startTime date format",
  }),
  endTime: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid endTime date format",
  }),
  excludeBookingId: z.string().optional(),
});

// Types
interface AuthUser {
  id: string;
  role?: string;
}

interface BookingOptions {
  status?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  page?: number;
}

// Custom error type for service errors
interface ServiceError extends Error {
  statusCode?: number;
}

// ---------------------------
// Create Booking
// ---------------------------
export const createBooking = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as AuthUser;
    if (!user?.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    const validation = createBookingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error
      });
    }

    const { roomId, startTime, endTime } = validation.data;

    const booking = await createBookingService(
      { 
        roomId, 
        startTime: new Date(startTime), 
        endTime: new Date(endTime) 
      },
      user.id
    );

    return res.status(201).json({
      success: true,
      data: booking,
      message: 'Booking created successfully'
    });

  } catch (error: unknown) {
    console.error('Create booking error:', error);
    
    if (error instanceof Error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode || 400).json({ 
        success: false, 
        message: serviceError.message || 'Failed to create booking' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while creating booking' 
    });
  }
};

// ---------------------------
// Reschedule Booking
// ---------------------------
export const rescheduleBooking = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as AuthUser;
    if (!user?.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    const bookingIdValidation = bookingIdSchema.safeParse(req.params);
    if (!bookingIdValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID',
        errors: bookingIdValidation.error
      });
    }

    const bodyValidation = rescheduleBookingSchema.safeParse(req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request body',
        errors: bodyValidation.error
      });
    }

    const { id: bookingId } = bookingIdValidation.data;
    const { startTime, endTime } = bodyValidation.data;

    const updatedBooking = await rescheduleBookingService(
      bookingId,
      { 
        startTime: new Date(startTime), 
        endTime: new Date(endTime) 
      },
      user.id
    );

    return res.status(200).json({
      success: true,
      data: updatedBooking,
      message: 'Booking rescheduled successfully'
    });

  } catch (error: unknown) {
    console.error('Reschedule booking error:', error);
    
    if (error instanceof Error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode || 400).json({ 
        success: false, 
        message: serviceError.message || 'Failed to reschedule booking' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while rescheduling booking' 
    });
  }
};

// ---------------------------
// List Bookings for Current User
// ---------------------------
export const listUserBookings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as AuthUser;
    if (!user?.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    const queryValidation = listUserBookingsSchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: queryValidation.error
      });
    }

    const { status, limit, page } = queryValidation.data;

    const options: BookingOptions = {
      status,
      limit,
      page,
    };

    const bookings = await getBookingsByUserId(user.id, options);

    return res.status(200).json({
      success: true,
      data: bookings,
      count: bookings.length,
      meta: {
        page: page || 1,
        limit: limit || bookings.length
      }
    });

  } catch (error: unknown) {
    console.error('List user bookings error:', error);
    
    if (error instanceof Error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode || 400).json({ 
        success: false, 
        message: serviceError.message || 'Failed to fetch bookings' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while fetching user bookings' 
    });
  }
};

// ---------------------------
// Admin: List All Bookings
// ---------------------------
export const listAllBookings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as AuthUser;
    if (user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Forbidden: Admin access required' 
      });
    }

    const queryValidation = listAllBookingsSchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: queryValidation.error
      });
    }

    const { status, fromDate, toDate, limit, page } = queryValidation.data;

    const options: BookingOptions = {
      status,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      limit,
      page,
    };

    const bookings = await getAllBookings(options);

    return res.status(200).json({
      success: true,
      data: bookings,
      count: bookings.length,
      meta: {
        page: page || 1,
        limit: limit || bookings.length,
        filters: {
          status,
          fromDate,
          toDate
        }
      }
    });

  } catch (error: unknown) {
    console.error('List all bookings error:', error);
    
    if (error instanceof Error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode || 400).json({ 
        success: false, 
        message: serviceError.message || 'Failed to fetch bookings' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while fetching all bookings' 
    });
  }
};

// ---------------------------
// Admin: List All Bookings Grouped by Room
// ---------------------------
export const listAllBookingsGroupedByRoom = async (
  req: Request, 
  res: Response
): Promise<Response> => {
  try {
    const user = req.user as AuthUser;
    if (user?.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Forbidden: Admin access required' 
      });
    }

    const queryValidation = listAllBookingsSchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: queryValidation.error
      });
    }

    const { fromDate, toDate } = queryValidation.data;

    const options: BookingOptions = {
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      status: 'confirmed',
    };

    const bookings = await getAllBookings(options);

    // Group by room
    const grouped = bookings.reduce((acc: Record<string, GroupedBooking>, booking: any) => {
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
      data: Object.values(grouped),
      meta: {
        totalRooms: Object.keys(grouped).length,
        totalBookings: bookings.length
      }
    });

  } catch (error: unknown) {
    console.error('List grouped bookings error:', error);
    
    if (error instanceof Error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode || 400).json({ 
        success: false, 
        message: serviceError.message || 'Failed to fetch bookings' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while fetching grouped bookings' 
    });
  }
};

// ---------------------------
// Cancel Booking
// ---------------------------
export const cancelUserBooking = async (req: Request, res: Response): Promise<Response> => {
  try {
    const user = req.user as AuthUser;
    if (!user?.id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized' 
      });
    }

    const bookingIdValidation = bookingIdSchema.safeParse(req.params);
    if (!bookingIdValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID',
        errors: bookingIdValidation.error
      });
    }

    const { id: bookingId } = bookingIdValidation.data;

    const cancelledBooking = await cancelBookingService(bookingId, user.id);

    return res.status(200).json({
      success: true,
      data: cancelledBooking,
      message: 'Booking cancelled successfully'
    });

  } catch (error: unknown) {
    console.error('Cancel booking error:', error);
    
    if (error instanceof Error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode || 400).json({ 
        success: false, 
        message: serviceError.message || 'Failed to cancel booking' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while cancelling booking' 
    });
  }
};

// ---------------------------
// List Bookings by Room
// ---------------------------
export const getRoomBookings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const roomIdValidation = roomIdParamSchema.safeParse(req.params);
    if (!roomIdValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID',
        errors: roomIdValidation.error
      });
    }

    const queryValidation = getRoomBookingsSchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: queryValidation.error
      });
    }

    const { roomId } = roomIdValidation.data;
    const { fromDate, toDate, status, limit, page } = queryValidation.data;

    const options: BookingOptions = {
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      status,
      limit,
      page,
    };

    const bookings = await getBookingsByRoomId(roomId, options);

    return res.status(200).json({
      success: true,
      data: bookings,
      count: bookings.length,
      meta: {
        roomId,
        page: page || 1,
        limit: limit || bookings.length,
        dateRange: {
          from: fromDate,
          to: toDate
        }
      }
    });

  } catch (error: unknown) {
    console.error('Get room bookings error:', error);
    
    if (error instanceof Error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode || 400).json({ 
        success: false, 
        message: serviceError.message || 'Failed to fetch room bookings' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while fetching room bookings' 
    });
  }
};

// ---------------------------
// Get Bookings for Room on Specific Date
// ---------------------------
export const getBookingsForRoomByDate = async (
  req: Request, 
  res: Response
): Promise<Response> => {
  try {
    const roomIdValidation = roomIdParamSchema.safeParse(req.params);
    if (!roomIdValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID',
        errors: roomIdValidation.error
      });
    }

    const queryValidation = getBookingsForRoomByDateSchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date parameter',
        errors: queryValidation.error
      });
    }

    const { roomId } = roomIdValidation.data;
    const { date } = queryValidation.data;

    const bookings = await getBookingsForRoom(roomId, date);

    return res.status(200).json({
      success: true,
      data: bookings,
      meta: {
        roomId,
        date,
        count: bookings.length
      }
    });

  } catch (error: unknown) {
    console.error('Get bookings for room by date error:', error);
    
    if (error instanceof Error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode || 400).json({ 
        success: false, 
        message: serviceError.message || 'Failed to fetch bookings' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while fetching bookings for room' 
    });
  }
};

// ---------------------------
// Single Booking by ID
// ---------------------------
export const getBooking = async (req: Request, res: Response): Promise<Response> => {
  try {
    const bookingIdValidation = bookingIdSchema.safeParse(req.params);
    if (!bookingIdValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID',
        errors: bookingIdValidation.error
      });
    }

    const user = req.user as AuthUser;
    const { id: bookingId } = bookingIdValidation.data;

    const booking = await getBookingById(bookingId);

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }

    // Check if user is authorized to view this booking
    const isOwner = booking.userId.toString() === user?.id;
    const isAdmin = user?.role === 'admin';

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

  } catch (error: unknown) {
    console.error('Get booking error:', error);
    
    if (error instanceof Error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode || 400).json({ 
        success: false, 
        message: serviceError.message || 'Failed to fetch booking' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while fetching booking' 
    });
  }
};

// ---------------------------
// Check Room Availability
// ---------------------------
export const checkAvailability = async (req: Request, res: Response): Promise<Response> => {
  try {
    const validation = checkAvailabilitySchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error
      });
    }

    const { roomId, startTime, endTime, excludeBookingId } = validation.data;

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
        requestedEndTime: endTime,
        excludeBookingId: excludeBookingId || null
      }
    });

  } catch (error: unknown) {
    console.error('Check availability error:', error);
    
    if (error instanceof Error) {
      const serviceError = error as ServiceError;
      return res.status(serviceError.statusCode || 400).json({ 
        success: false, 
        message: serviceError.message || 'Failed to check availability' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while checking availability' 
    });
  }
};