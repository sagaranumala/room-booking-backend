import { Request, Response } from 'express';
import Room from '../models/room.model';
import Booking from '../models/booking.model';
import { 
  calculateAvailableSlots, 
  formatDateToYYYYMMDD,
  isWithinBusinessHours 
} from '../utils/date.util';
import { ApiResponse, AvailableSlotResponse, RoomAvailability } from '../types/index';

// Create a new room (admin only)
export const createRoom = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, capacity, description, amenities } = req.body;

    // Validation
    if (!name || !capacity) {
      return res.status(400).json({
        success: false,
        message: 'Name and capacity are required'
      });
    }

    if (typeof capacity !== 'number' || capacity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Capacity must be a positive number'
      });
    }

    // Check if room with same name already exists
    const existingRoom = await Room.findOne({ name });
    if (existingRoom) {
      return res.status(409).json({
        success: false,
        message: 'Room with this name already exists'
      });
    }

    // Create new room
    const newRoom = await Room.create({
      name,
      capacity,
      description: description || '',
      amenities: amenities || [],
      isActive: true
    });

    return res.status(201).json({
      success: true,
      data: newRoom,
      message: 'Room created successfully'
    });

  } catch (error: any) {
    console.error('Create room error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Room name already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error creating room',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all rooms
export const getAllRooms = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { activeOnly } = req.query;
    
    const query: any = {};
    if (activeOnly === 'true') {
      query.isActive = true;
    }

    const rooms = await Room.find(query).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      data: rooms,
      count: rooms.length
    });

  } catch (error: any) {
    console.error('Get all rooms error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching rooms'
    });
  }
};

// Get single room by ID
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

  } catch (error: any) {
    console.error('Get room by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching room'
    });
  }
};

// Update room (admin only)
export const updateRoom = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { name, capacity, description, amenities, isActive } = req.body;

    const room = await Room.findById(id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Update fields
    if (name !== undefined) room.name = name;
    if (capacity !== undefined) room.capacity = capacity;
    if (description !== undefined) room.description = description;
    if (amenities !== undefined) room.amenities = amenities;
    if (isActive !== undefined) room.isActive = isActive;

    await room.save();

    return res.status(200).json({
      success: true,
      data: room,
      message: 'Room updated successfully'
    });

  } catch (error: any) {
    console.error('Update room error:', error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Room name already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Error updating room'
    });
  }
};

// Delete room (admin only - soft delete)
// export const deleteRoom = async (req: Request, res: Response): Promise<Response> => {
//   try {
//     const { id } = req.params;

//     const room = await Room.findById(id);
    
//     if (!room) {
//       return res.status(404).json({
//         success: false,
//         message: 'Room not found'
//       });
//     }

//     // Soft delete by marking as inactive
//     room.isActive = false;
//     await room.save();

//     return res.status(200).json({
//       success: true,
//       message: 'Room deactivated successfully'
//     });

//   } catch (error: any) {
//     console.error('Delete room error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Error deactivating room'
//     });
//   }
// };

// SOFT DELETE (make inactive)
export const deactivateRoom = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    room.isActive = false;
    await room.save();

    return res.status(200).json({
      success: true,
      message: "Room deactivated successfully"
    });

  } catch (error: any) {
    console.error("Deactivate room error:", error);
    return res.status(500).json({ success: false, message: "Error deactivating room" });
  }
};


// ACTIVATE ROOM (undo soft delete)
export const activateRoom = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    room.isActive = true;
    await room.save();

    return res.status(200).json({
      success: true,
      message: "Room activated successfully"
    });

  } catch (error: any) {
    console.error("Activate room error:", error);
    return res.status(500).json({ success: false, message: "Error activating room" });
  }
};


// PERMANENT DELETE (remove document)
export const deleteRoomPermanent = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;

    const room = await Room.findById(id);

    if (!room) {
      return res.status(404).json({ success: false, message: "Room not found" });
    }

    await Room.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Room permanently deleted"
    });

  } catch (error: any) {
    console.error("Permanent delete error:", error);
    return res.status(500).json({ success: false, message: "Error deleting room" });
  }
};


// Check room availability with date
export const checkAvailability = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { date, roomId } = req.query;
    
    // Validate date
    if (!date || typeof date !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required and must be a string (YYYY-MM-DD)'
      });
    }

    const targetDate = new Date(date);
    
    // Validate date format
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // Build query for bookings
    const query: any = {
      startTime: {
        $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
        $lt: new Date(targetDate.setHours(23, 59, 59, 999))
      },
      status: { $in: ['confirmed', 'pending'] }
    };

    // If roomId is specified, only check that room
    if (roomId && typeof roomId === 'string') {
      query.roomId = roomId;
      
      // Check if room exists and is active
      const room = await Room.findById(roomId);
      if (!room || !room.isActive) {
        return res.status(404).json({
          success: false,
          message: 'Room not found or inactive'
        });
      }

      const bookings = await Booking.find(query).sort({ startTime: 1 });
      
      const availableSlots = calculateAvailableSlots(
        bookings, 
        targetDate,
        9, // opening hour
        18, // closing hour
        30 // slot duration minutes
      );

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
      // Check all active rooms
      const activeRooms = await Room.find({ isActive: true });
      const allBookings = await Booking.find(query);
      
      const availability = await Promise.all(
        activeRooms.map(async (room) => {
          const roomBookings = allBookings.filter(
            booking => booking.roomId.toString() === room._id.toString()
          );
          
          const availableSlots = calculateAvailableSlots(
            roomBookings,
            targetDate
          );

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
        })
      );

      // Filter out rooms with no availability if requested
      const { showAll } = req.query;
      const filteredAvailability = showAll === 'true' 
        ? availability 
        : availability.filter(room => room.totalAvailableSlots > 0);

      return res.status(200).json({
        success: true,
        data: filteredAvailability,
        date: formatDateToYYYYMMDD(targetDate),
        totalRooms: filteredAvailability.length,
        roomsWithAvailability: filteredAvailability.filter(r => r.totalAvailableSlots > 0).length
      });
    }

  } catch (error: any) {
    console.error('Check availability error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking availability'
    });
  }
};

// Get room bookings for a specific date
export const getRoomBookings = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { roomId } = req.params;
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required (YYYY-MM-DD)'
      });
    }

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const bookings = await Booking.find({
      roomId,
      startTime: { $gte: startOfDay },
      endTime: { $lte: endOfDay },
      status: { $in: ['confirmed', 'pending'] }
    })
      .sort({ startTime: 1 })
      .populate('userId', 'name email');

    return res.status(200).json({
      success: true,
      data: {
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
      }
    });

  } catch (error: any) {
    console.error('Get room bookings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching room bookings'
    });
  }
};

export const getRoomAvailabilityByDate = async (req: Request, res: Response) => {
  try {
    const { date } = req.query as { date: string };
    if (!date) return res.status(400).json({ success: false, message: "Date is required" });

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime()))
      return res.status(400).json({ success: false, message: "Invalid date format" });

    // Fetch active rooms
    const activeRooms = await Room.find({ isActive: true });
    if (!activeRooms) throw new Error("No active rooms found");

    const DAYS_RANGE = 7; // Number of days to check availability
    const endDate = new Date(targetDate.getTime() + (DAYS_RANGE - 1) * 24 * 60 * 60 * 1000);

    // Fetch bookings for the date range
    const bookings = await Booking.find({
      startTime: { $gte: targetDate, $lt: new Date(endDate.getTime() + 24 * 60 * 60 * 1000) },
      status: { $in: ["confirmed", "pending"] },
    });

    const availability = activeRooms.map((room) => {
      const roomBookings = bookings.filter((b) => b.roomId.toString() === room._id.toString());

      // Generate day-wise availability
      const availableSlots: string[] = [];
      for (let i = 0; i < DAYS_RANGE; i++) {
        const currentDate = new Date(targetDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(currentDate.setHours(0, 0, 0, 0));
        const dayEnd = new Date(currentDate.setHours(23, 59, 59, 999));

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
          amenities: room.amenities,
          description: room.description,
        },
        date: targetDate.toISOString().split("T")[0],
        availableSlots, // now this is array of available dates
        totalAvailableSlots: availableSlots.length,
        isAvailable: availableSlots.length > 0,
        totalBookings: roomBookings.length,
        nextAvailableSlot: availableSlots[0] || null,
        lastAvailableSlot: availableSlots[availableSlots.length - 1] || null,
      };
    });

    res.status(200).json({
      success: true,
      data: availability,
      totalRooms: availability.length,
      roomsWithAvailability: availability.filter((r) => r.isAvailable).length,
    });
  } catch (error: any) {
    console.error("Error in getRoomAvailabilityByDate:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
      stack: error.stack,
    });
  }
};



// all room availability by slots
export const getRoomAvailabilityBySlots = async (req: Request, res: Response) => {
  try {
    const { date } = req.query as { date: string };
    if (!date) return res.status(400).json({ success: false, message: "Date is required" });

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) return res.status(400).json({ success: false, message: "Invalid date format" });

    // Fetch active rooms
    const activeRooms = await Room.find({ isActive: true });
    if (!activeRooms) throw new Error("No active rooms found");

    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const bookings = await Booking.find({
      startTime: { $gte: startOfDay, $lt: endOfDay },
      status: { $in: ["confirmed", "pending"] },
    });

    const availability = activeRooms.map((room) => {
      const roomBookings = bookings.filter((b) => b.roomId.toString() === room._id.toString());

      // Make sure calculateAvailableSlots is imported and works
      const availableSlotsRaw = calculateAvailableSlots(roomBookings, targetDate, 9, 18, 30);
      if (!availableSlotsRaw) throw new Error("calculateAvailableSlots returned undefined");

      const availableSlots = availableSlotsRaw.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        durationMinutes: slot.durationMinutes,
        startTime: slot.start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        endTime: slot.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }));

      return {
        room: {
          id: room._id.toString(),
          name: room.name,
          capacity: room.capacity,
          amenities: room.amenities,
          description: room.description,
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

    res.status(200).json({
      success: true,
      data: availability,
      totalRooms: availability.length,
      roomsWithAvailability: availability.filter((r) => r.isAvailable).length,
    });
  } catch (error: any) {
    console.error("Error in getRoomAvailabilityByDate:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
      stack: error.stack,
    });
  }
};
