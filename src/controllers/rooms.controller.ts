import { Request, Response } from 'express';
import { z } from 'zod';
import Room from '../models/room.model';
import bookingSchema from '../models/booking.model';
import { 
  calculateAvailableSlots, 
  formatDateToYYYYMMDD 
} from '../utils/date.util';
import { FilterQuery } from 'mongoose';
import { Booking, RoomAvailabilityData, RoomAvailabilitySlots } from '../types';

// -------------------- Zod Schemas --------------------
const createRoomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  capacity: z.number().int().positive("Capacity must be a positive number"),
  description: z.string().optional(),
  amenities: z.array(z.string()).optional(),
});

const updateRoomSchema = z.object({
  name: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  description: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
  roomId: z.string().optional(),
  showAll: z.string().optional(),
});

// Error type for MongoDB duplicate key errors
interface MongoError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

// -------------------- ROOM CRUD --------------------

// Create Room
export const createRoom = async (req: Request, res: Response): Promise<Response> => {
  try {
    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        message: parsed.error
      });
    }

    const { name, capacity, description, amenities } = parsed.data;

    const existingRoom = await Room.findOne({ name });
    if (existingRoom) {
      return res.status(409).json({ 
        success: false, 
        message: 'Room with this name already exists' 
      });
    }

    const newRoom = await Room.create({
      name,
      capacity,
      description: description || '',
      amenities: amenities || [],
      isActive: true,
    });

    return res.status(201).json({ 
      success: true, 
      data: newRoom, 
      message: 'Room created successfully' 
    });
  } catch (error: unknown) {
    console.error('Create room error:', error);
    
    if (error instanceof Error) {
      const mongoError = error as MongoError;
      if (mongoError.code === 11000) {
        return res.status(409).json({ 
          success: false, 
          message: 'Room name already exists' 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: 'Error creating room', 
        error: mongoError.message 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while creating room' 
    });
  }
};

// Get All Rooms
export const getAllRooms = async (req: Request, res: Response): Promise<Response> => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const query = activeOnly ? { isActive: true } : {};
    const rooms = await Room.find(query).sort({ name: 1 });
    
    return res.status(200).json({ 
      success: true, 
      data: rooms, 
      count: rooms.length 
    });
  } catch (error: unknown) {
    console.error('Get all rooms error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error fetching rooms',
      error: errorMessage
    });
  }
};

// Get Room By ID
export const getRoomById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id);
    
    if (!room) {
      return res.status(404).json({ 
        success: false, 
        message: 'Room not found' 
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      data: room 
    });
  } catch (error: unknown) {
    console.error('Get room by ID error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error fetching room',
      error: errorMessage
    });
  }
};

// Update Room
export const updateRoom = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const parsed = updateRoomSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        message: parsed.error
      });
    }

    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ 
        success: false, 
        message: 'Room not found' 
      });
    }

    Object.assign(room, parsed.data);
    await room.save();

    return res.status(200).json({ 
      success: true, 
      data: room, 
      message: 'Room updated successfully' 
    });
  } catch (error: unknown) {
    console.error('Update room error:', error);
    
    if (error instanceof Error) {
      const mongoError = error as MongoError;
      if (mongoError.code === 11000) {
        return res.status(409).json({ 
          success: false, 
          message: 'Room name already exists' 
        });
      }
      
      return res.status(500).json({ 
        success: false, 
        message: 'Error updating room',
        error: mongoError.message
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Unknown error occurred while updating room' 
    });
  }
};

// Deactivate Room
export const deactivateRoom = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id);
    
    if (!room) {
      return res.status(404).json({ 
        success: false, 
        message: "Room not found" 
      });
    }

    room.isActive = false;
    await room.save();
    
    return res.status(200).json({ 
      success: true, 
      message: "Room deactivated successfully" 
    });
  } catch (error: unknown) {
    console.error("Deactivate room error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({ 
      success: false, 
      message: "Error deactivating room",
      error: errorMessage
    });
  }
};

// Activate Room
export const activateRoom = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id);
    
    if (!room) {
      return res.status(404).json({ 
        success: false, 
        message: "Room not found" 
      });
    }

    room.isActive = true;
    await room.save();
    
    return res.status(200).json({ 
      success: true, 
      message: "Room activated successfully" 
    });
  } catch (error: unknown) {
    console.error("Activate room error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({ 
      success: false, 
      message: "Error activating room",
      error: errorMessage
    });
  }
};

// Permanent Delete Room
export const deleteRoomPermanent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const room = await Room.findById(id);
    
    if (!room) {
      return res.status(404).json({ 
        success: false, 
        message: "Room not found" 
      });
    }

    await Room.findByIdAndDelete(id);
    
    return res.status(200).json({ 
      success: true, 
      message: "Room permanently deleted" 
    });
  } catch (error: unknown) {
    console.error("Permanent delete error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({ 
      success: false, 
      message: "Error deleting room",
      error: errorMessage
    });
  }
};

// -------------------- ROOM AVAILABILITY --------------------

// Check Availability for a room or all rooms
export const checkAvailability = async (req: Request, res: Response): Promise<Response> => {
  try {
    const parsed = dateQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ 
        success: false, 
        message: parsed.error
      });
    }

    const { date, roomId, showAll } = parsed.data;
    const targetDate = new Date(date);

    // Define query as a flexible Mongoose filter
    const query: FilterQuery<Booking> = {
      startTime: { 
        $gte: new Date(targetDate.setHours(0, 0, 0, 0)), 
        $lt: new Date(targetDate.setHours(23, 59, 59, 999)) 
      },
      status: { $in: ['confirmed', 'pending'] },
    };

    // Only add roomId if provided
    if (roomId) {
      query.roomId = roomId;
    }

    if (roomId) {
      const room = await Room.findById(roomId);
      if (!room || !room.isActive) {
        return res.status(404).json({ 
          success: false, 
          message: 'Room not found or inactive' 
        });
      }

      const bookings = await bookingSchema.find(query).sort({ startTime: 1 });
      const availableSlots = calculateAvailableSlots(bookings, targetDate, 9, 18, 30);

      return res.status(200).json({
        success: true,
        data: {
          room: { 
            id: room._id, 
            name: room.name, 
            capacity: room.capacity, 
            amenities: room.amenities 
          },
          date: formatDateToYYYYMMDD(targetDate),
          availableSlots: availableSlots.map(slot => ({
            start: slot.start.toISOString(),
            end: slot.end.toISOString(),
            durationMinutes: slot.durationMinutes
          })),
          totalAvailableSlots: availableSlots.length
        }
      });
    } else {
      const activeRooms = await Room.find({ isActive: true });
      const allBookings = await bookingSchema.find(query);

      const availability = activeRooms.map(room => {
        const roomBookings = allBookings.filter(
          booking => booking.roomId.toString() === room._id.toString()
        );
        const availableSlots = calculateAvailableSlots(roomBookings, targetDate);

        return {
          room: { 
            id: room._id, 
            name: room.name, 
            capacity: room.capacity, 
            amenities: room.amenities 
          },
          date: formatDateToYYYYMMDD(targetDate),
          availableSlots: availableSlots.map(slot => ({
            start: slot.start.toISOString(),
            end: slot.end.toISOString(),
            durationMinutes: slot.durationMinutes
          })),
          totalAvailableSlots: availableSlots.length,
          isAvailable: availableSlots.length > 0
        };
      });

      const filteredAvailability = showAll === 'true' 
        ? availability 
        : availability.filter(room => room.totalAvailableSlots > 0);

      return res.status(200).json({
        success: true,
        data: filteredAvailability,
        date: formatDateToYYYYMMDD(targetDate),
        totalRooms: filteredAvailability.length,
        roomsWithAvailability: filteredAvailability.filter(room => room.totalAvailableSlots > 0).length
      });
    }

  } catch (error: unknown) {
    console.error('Check availability error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return res.status(500).json({ 
      success: false, 
      message: 'Error checking availability', 
      error: errorMessage 
    });
  }
};

// -------------------- Zod Schemas --------------------
const getRoomBookingsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
});

const roomIdParamSchema = z.object({
  roomId: z.string().min(1, "Room ID is required"),
});

const getRoomAvailabilityByDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
});

// -------------------- Get Room Bookings --------------------
export const getRoomBookings = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Validate roomId parameter
    const roomIdValidation = roomIdParamSchema.safeParse(req.params);
    if (!roomIdValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid room ID',
        errors: roomIdValidation.error
      });
    }

    // Validate date query parameter
    const dateValidation = getRoomBookingsSchema.safeParse(req.query);
    if (!dateValidation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date parameter',
        errors: dateValidation.error
      });
    }

    const { roomId } = roomIdValidation.data;
    const { date } = dateValidation.data;

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await bookingSchema.find({
      roomId,
      startTime: { $gte: startOfDay },
      endTime: { $lte: endOfDay },
      status: { $in: ['confirmed', 'pending'] }
    })
      .sort({ startTime: 1 })
      .populate('userId', 'name email');

    const response = {
      room: {
        id: room._id,
        name: room.name,
        capacity: room.capacity
      },
      date: formatDateToYYYYMMDD(targetDate),
      bookings: bookings.map(booking => ({
        id: booking._id,
        user: booking.userId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status
      })),
      totalBookings: bookings.length
    };

    return res.status(200).json({
      success: true,
      data: response
    });

  } catch (error: unknown) {
    console.error('Get room bookings error:', error);
    
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching room bookings',
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: 'Unknown error occurred while fetching room bookings'
    });
  }
};

// -------------------- Get Room Availability By Date --------------------
export const getRoomAvailabilityByDate = async (req: Request, res: Response): Promise<Response> => {
  try {
    // Validate date query parameter
    const dateValidation = getRoomAvailabilityByDateSchema.safeParse(req.query);
    if (!dateValidation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid date parameter",
        errors: dateValidation.error
      });
    }

    const { date } = dateValidation.data;
    const targetDate = new Date(date);
    
    // Additional date validation
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format"
      });
    }

    // Fetch active rooms
    const activeRooms = await Room.find({ isActive: true });
    if (activeRooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active rooms found"
      });
    }

    const DAYS_RANGE = 7; // Number of days to check availability
    const endDate = new Date(targetDate);
    endDate.setDate(targetDate.getDate() + DAYS_RANGE - 1);
    endDate.setHours(23, 59, 59, 999);

    const startOfRange = new Date(targetDate);
    startOfRange.setHours(0, 0, 0, 0);

    // Fetch bookings for the date range
    const bookings = await bookingSchema.find({
      startTime: { $gte: startOfRange, $lt: endDate },
      status: { $in: ["confirmed", "pending"] },
    });

    const availability: RoomAvailabilityData[] = activeRooms.map((room) => {
      const roomBookings = bookings.filter((b) => 
        b.roomId.toString() === room._id.toString()
      );

      // Generate day-wise availability
      const availableSlots: string[] = [];
      for (let i = 0; i < DAYS_RANGE; i++) {
        const currentDate = new Date(targetDate);
        currentDate.setDate(targetDate.getDate() + i);
        currentDate.setHours(0, 0, 0, 0);
        
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const bookingsForDay = roomBookings.filter(
          (b) => b.startTime >= dayStart && b.startTime <= dayEnd
        );

        if (bookingsForDay.length === 0) {
          availableSlots.push(dayStart.toISOString().split("T")[0]);
        }
      }

      return {
        room: {
          id: room._id.toString(),
          name: room.name,
          capacity: room.capacity,
          amenities: room.amenities || [],
          description: room.description || '',
        },
        date: targetDate.toISOString().split("T")[0],
        availableSlots,
        totalAvailableSlots: availableSlots.length,
        isAvailable: availableSlots.length > 0,
        totalBookings: roomBookings.length,
        nextAvailableSlot: availableSlots[0] || null,
        lastAvailableSlot: availableSlots[availableSlots.length - 1] || null,
      };
    });

    const roomsWithAvailability = availability.filter((r) => r.isAvailable).length;

    return res.status(200).json({
      success: true,
      data: availability,
      meta: {
        date: targetDate.toISOString().split("T")[0],
        daysRange: DAYS_RANGE,
        totalRooms: availability.length,
        roomsWithAvailability,
        percentageAvailable: availability.length > 0 
          ? Math.round((roomsWithAvailability / availability.length) * 100) 
          : 0
      }
    });
  } catch (error: unknown) {
    console.error("Error in getRoomAvailabilityByDate:", error);
    
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Unknown error occurred while fetching room availability"
    });
  }
};
// -------------------- Zod Schemas --------------------
const getRoomAvailabilityBySlotsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
});

// -------------------- Get Room Availability By Slots --------------------
export const getRoomAvailabilityBySlots = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Validate query parameters
    const validationResult = getRoomAvailabilityBySlotsSchema.safeParse(req.query);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationResult.error
      });
    }

    const { date } = validationResult.data;
    const targetDate = new Date(date);
    
    // Additional date validation
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid date format" 
      });
    }

    // Fetch active rooms
    const activeRooms = await Room.find({ isActive: true });
    if (activeRooms.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "No active rooms found" 
      });
    }

    // Set up date range for the day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch bookings for the day
    const bookings = await bookingSchema.find({
      startTime: { $gte: startOfDay, $lt: endOfDay },
      status: { $in: ["confirmed", "pending"] },
    });

    const availability: RoomAvailabilitySlots[] = activeRooms.map((room) => {
      const roomBookings = bookings.filter((booking) => 
        booking.roomId.toString() === room._id.toString()
      );

      // Calculate available slots
      const availableSlotsRaw = calculateAvailableSlots(roomBookings, targetDate, 9, 18, 30);
      
      // Handle potential null/undefined from calculateAvailableSlots
      if (!availableSlotsRaw || !Array.isArray(availableSlotsRaw)) {
        return {
          room: {
            id: room._id.toString(),
            name: room.name,
            capacity: room.capacity,
            amenities: room.amenities || [],
            description: room.description || '',
          },
          date: targetDate.toISOString().split("T")[0],
          availableSlots: [],
          totalAvailableSlots: 0,
          isAvailable: false,
          totalBookings: roomBookings.length,
          nextAvailableSlot: null,
          lastAvailableSlot: null,
        };
      }

      // Format available slots
      const availableSlots = availableSlotsRaw.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        durationMinutes: slot.durationMinutes,
        startTime: slot.start.toLocaleTimeString([], { 
          hour: "2-digit", 
          minute: "2-digit",
          hour12: false 
        }),
        endTime: slot.end.toLocaleTimeString([], { 
          hour: "2-digit", 
          minute: "2-digit",
          hour12: false 
        }),
      }));

      return {
        room: {
          id: room._id.toString(),
          name: room.name,
          capacity: room.capacity,
          amenities: room.amenities || [],
          description: room.description || '',
        },
        date: targetDate.toISOString().split("T")[0],
        availableSlots,
        totalAvailableSlots: availableSlots.length,
        isAvailable: availableSlots.length > 0,
        totalBookings: roomBookings.length,
        nextAvailableSlot: availableSlots[0]?.start || null,
        lastAvailableSlot: availableSlots[availableSlots.length - 1]?.end || null,
      };
    });

    const roomsWithAvailability = availability.filter((room) => room.isAvailable).length;

    return res.status(200).json({
      success: true,
      data: availability,
      meta: {
        date: targetDate.toISOString().split("T")[0],
        totalRooms: availability.length,
        roomsWithAvailability,
        roomsWithNoAvailability: availability.length - roomsWithAvailability,
        percentageAvailable: availability.length > 0 
          ? Math.round((roomsWithAvailability / availability.length) * 100) 
          : 0
      }
    });

  } catch (error: unknown) {
    console.error("Error in getRoomAvailabilityBySlots:", error);
    
    if (error instanceof Error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Unknown error occurred while fetching room availability by slots"
    });
  }
};