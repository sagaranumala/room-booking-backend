// import Room from '../models/room.model';
// import { calculateAvailableSlots } from '../utils/date.util';
// import { getBookingsForRoom } from './booking.service';

// // CREATE ROOM
// export const createRoom = async (roomData: any) => {
//     const room = new Room(roomData);
//     return await room.save();
// };

// // CHECK ROOM AVAILABILITY
// export const checkRoomAvailability = async (date: string) => {
//     const rooms = await Room.find();   // ✔ fetch rooms from DB
//     const availableRooms: any[] = [];

//     for (const room of rooms) {
//         const bookings = await getBookingsForRoom(room._id.toString(), date);

//         const availableSlots = calculateAvailableSlots(bookings);

//         if (availableSlots.length > 0) {
//             availableRooms.push({
//                 roomId: room._id,
//                 roomName: room.name,
//                 availableSlots,
//             });
//         }
//     }

//     return availableRooms;
// };

import { z } from 'zod';
import Room from '../models/room.model';
import BookingModel from '../models/booking.model';
import { 
  calculateAvailableSlots, 
  formatDateToYYYYMMDD 
} from '../utils/date.util';
import { 
  Booking, 
  RoomAvailability, 
  AvailableSlotResponse,
  Room as RoomType 
} from '../types/index';
import { FilterQuery, Types } from 'mongoose';

// -------------------- Zod Schemas --------------------
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Invalid date format. Use YYYY-MM-DD"
});

const roomIdSchema = z.string().min(1, "Room ID is required");

const checkAvailabilitySchema = z.object({
  date: dateSchema,
  openingHour: z.number().min(0).max(23).optional(),
  closingHour: z.number().min(1).max(24).optional(),
  slotDuration: z.number().min(15).max(180).optional(),
  includeInactiveRooms: z.boolean().optional(),
});

const singleRoomAvailabilitySchema = z.object({
  date: dateSchema,
  openingHour: z.number().min(0).max(23).optional(),
  closingHour: z.number().min(1).max(24).optional(),
  slotDuration: z.number().min(15).max(180).optional(),
});

const timeSlotAvailabilitySchema = z.object({
  roomId: roomIdSchema,
  startTime: z.date(),
  endTime: z.date(),
  excludeBookingId: z.string().optional(),
});

const occupancySchema = z.object({
  roomId: roomIdSchema,
  startDate: dateSchema,
  endDate: dateSchema,
});

// -------------------- Types --------------------
interface AvailabilityOptions {
  openingHour?: number;
  closingHour?: number;
  slotDuration?: number;
  includeInactiveRooms?: boolean;
}

interface RoomOccupancyResult {
  room: {
    id: string;
    name: string;
    capacity: number;
  };
  dateRange: {
    start: string;
    end: string;
  };
  bookings: Booking[];
  occupancyRate: number;
}

// -------------------- Helper Functions --------------------
function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime());
}

function validateDateString(dateString: string): Date {
  const date = new Date(dateString);
  if (!isValidDate(date)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }
  return date;
}

// -------------------- Main Functions --------------------

// Get bookings for a room on a specific date
export const getBookingsForRoom = async (
  roomId: string, 
  date: string
): Promise<Booking[]> => {
  try {
    // Validate inputs
    const validatedRoomId = roomIdSchema.parse(roomId);
    const validatedDate = dateSchema.parse(date);

    const startOfDay = new Date(validatedDate + 'T00:00:00.000Z');
    const endOfDay = new Date(validatedDate + 'T23:59:59.999Z');

    const bookings = await BookingModel.find({
      roomId: validatedRoomId,
      startTime: { $gte: startOfDay },
      endTime: { $lte: endOfDay },
      status: { $in: ['confirmed', 'pending'] }
    }).sort({ startTime: 1 }).lean();

    return bookings as Booking[];
  } catch (error: unknown) {
    console.error(`Error fetching bookings for room ${roomId} on ${date}:`, error);
    
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error}`);
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Unknown error occurred while fetching bookings');
  }
};

// Check availability for all rooms on a specific date
export const checkRoomAvailability = async (
  date: string,
  options: AvailabilityOptions = {}
): Promise<RoomAvailability[]> => {
  try {
    // Validate and parse options
    const validationResult = checkAvailabilitySchema.safeParse({ 
      date, 
      ...options 
    });
    
    if (!validationResult.success) {
      throw new Error(
        `Validation error: ${validationResult.error}`
      );
    }

    const { 
      date: validatedDate,
      openingHour = 9,
      closingHour = 18,
      slotDuration = 30,
      includeInactiveRooms = false
    } = validationResult.data;

    // Validate date
    const targetDate = validateDateString(validatedDate);

    // Validate time constraints
    if (openingHour >= closingHour) {
      throw new Error('Opening hour must be before closing hour');
    }

    // Build room query
    const roomQuery: FilterQuery<RoomType> = {};
    if (!includeInactiveRooms) {
      roomQuery.isActive = true;
    }

    // Fetch all rooms
    const rooms = await Room.find(roomQuery).sort({ name: 1 });

    // Fetch all bookings for the date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const allBookings = await BookingModel.find({
      startTime: { $gte: startOfDay },
      endTime: { $lte: endOfDay },
      status: { $in: ['confirmed', 'pending'] }
    }).sort({ startTime: 1 }).lean();

    const availableRooms: RoomAvailability[] = [];

    // Process each room
    for (const room of rooms) {
      // Filter bookings for this specific room
      const roomBookings = allBookings.filter(
        booking => booking.roomId.toString() === room._id.toString()
      ) as Booking[];

      // Calculate available slots
      const availableSlots = calculateAvailableSlots(
        roomBookings,
        targetDate,
        openingHour,
        closingHour,
        slotDuration
      );

      // Format slots for response
      const formattedSlots: AvailableSlotResponse[] = availableSlots.map(slot => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        durationMinutes: slot.durationMinutes,
        startTime: slot.start.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        }),
        endTime: slot.end.toLocaleTimeString([], { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        })
      }));

      // Add room to results
      availableRooms.push({
        room: {
          id: room._id.toString(),
          name: room.name,
          capacity: room.capacity,
          amenities: room.amenities || [],
          description: room.description || ''
        },
        date: formatDateToYYYYMMDD(targetDate),
        availableSlots: formattedSlots,
        totalAvailableSlots: formattedSlots.length,
        isAvailable: formattedSlots.length > 0,
        totalBookings: roomBookings.length,
        nextAvailableSlot: formattedSlots.length > 0 ? formattedSlots[0].start : null,
        lastAvailableSlot: formattedSlots.length > 0 
          ? formattedSlots[formattedSlots.length - 1].start 
          : null
      });
    }

    return availableRooms;
  } catch (error: unknown) {
    console.error('Error checking room availability:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Unknown error occurred while checking room availability');
  }
};

// Check availability for a specific room
export const checkSingleRoomAvailability = async (
  roomId: string,
  date: string,
  options: Omit<AvailabilityOptions, 'includeInactiveRooms'> = {}
): Promise<RoomAvailability | null> => {
  try {
    // Validate inputs
    const validationResult = singleRoomAvailabilitySchema.safeParse({ 
      date, 
      ...options 
    });
    
    if (!validationResult.success) {
      throw new Error(
        `Validation error: ${validationResult.error}`
      );
    }

    const { 
      date: validatedDate,
      openingHour = 9,
      closingHour = 18,
      slotDuration = 30
    } = validationResult.data;

    // Validate date
    const targetDate = validateDateString(validatedDate);

    // Validate time constraints
    if (openingHour >= closingHour) {
      throw new Error('Opening hour must be before closing hour');
    }

    // Check if room exists and is active
    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    
    if (!room.isActive) {
      throw new Error('Room is inactive');
    }

    // Get bookings for the room on the specified date
    const bookings = await getBookingsForRoom(roomId, validatedDate);

    // Calculate available slots
    const availableSlots = calculateAvailableSlots(
      bookings,
      targetDate,
      openingHour,
      closingHour,
      slotDuration
    );

    // Format slots for response
    const formattedSlots: AvailableSlotResponse[] = availableSlots.map(slot => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      durationMinutes: slot.durationMinutes,
      startTime: slot.start.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      endTime: slot.end.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    }));

    return {
      room: {
        id: room._id.toString(),
        name: room.name,
        capacity: room.capacity,
        amenities: room.amenities || [],
        description: room.description || ''
      },
      date: formatDateToYYYYMMDD(targetDate),
      availableSlots: formattedSlots,
      totalAvailableSlots: formattedSlots.length,
      isAvailable: formattedSlots.length > 0,
      totalBookings: bookings.length,
      nextAvailableSlot: formattedSlots.length > 0 ? formattedSlots[0].start : null,
      lastAvailableSlot: formattedSlots.length > 0 
        ? formattedSlots[formattedSlots.length - 1].start 
        : null
    };
  } catch (error: unknown) {
    console.error(`Error checking availability for room ${roomId}:`, error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Unknown error occurred while checking room availability');
  }
};

// Check if a specific time slot is available
export const isTimeSlotAvailable = async (
  roomId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
): Promise<boolean> => {
  try {
    // Validate inputs
    const validationResult = timeSlotAvailabilitySchema.safeParse({ 
      roomId, 
      startTime, 
      endTime, 
      excludeBookingId 
    });
    
    if (!validationResult.success) {
      throw new Error(
        `Validation error: ${validationResult.error}`
      );
    }

    const { 
      roomId: validatedRoomId, 
      startTime: validatedStartTime, 
      endTime: validatedEndTime,
      excludeBookingId: validatedExcludeBookingId 
    } = validationResult.data;

    // Validate time order
    if (validatedStartTime >= validatedEndTime) {
      throw new Error('Start time must be before end time');
    }

    // Build query
    const query: FilterQuery<Booking> = {
      roomId: validatedRoomId,
      startTime: { $lt: validatedEndTime },
      endTime: { $gt: validatedStartTime },
      status: { $in: ['confirmed', 'pending'] as const }
    };

    // Exclude current booking when checking for rescheduling
    if (validatedExcludeBookingId) {
      query._id = { $ne: new Types.ObjectId(validatedExcludeBookingId) };
    }

    const conflictingBookings = await BookingModel.find(query);

    return conflictingBookings.length === 0;
  } catch (error: unknown) {
    console.error('Error checking time slot availability:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Unknown error occurred while checking time slot availability');
  }
};

// Get room occupancy for a date range
export const getRoomOccupancy = async (
  roomId: string,
  startDate: string,
  endDate: string
): Promise<RoomOccupancyResult> => {
  try {
    // Validate inputs
    const validationResult = occupancySchema.safeParse({ 
      roomId, 
      startDate, 
      endDate 
    });
    
    if (!validationResult.success) {
      throw new Error(
        `Validation error: ${validationResult.error}`
      );
    }

    const { 
      roomId: validatedRoomId, 
      startDate: validatedStartDate, 
      endDate: validatedEndDate 
    } = validationResult.data;

    // Validate dates
    const start = validateDateString(validatedStartDate + 'T00:00:00.000Z');
    const end = validateDateString(validatedEndDate + 'T23:59:59.999Z');

    // Validate date range
    if (start > end) {
      throw new Error('Start date must be before end date');
    }

    const room = await Room.findById(validatedRoomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const bookings = await BookingModel.find({
      roomId: validatedRoomId,
      startTime: { $gte: start },
      endTime: { $lte: end },
      status: 'confirmed'
    })
      .sort({ startTime: 1 })
      .lean() as Booking[];

    // Calculate total business hours in the date range
    const totalHours = calculateBusinessHours(start, end);
    
    // Calculate booked hours
    let bookedHours = 0;
    bookings.forEach(booking => {
      const duration = (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60 * 60);
      bookedHours += duration;
    });

    const occupancyRate = totalHours > 0 ? (bookedHours / totalHours) * 100 : 0;

    return {
      room: {
        id: room._id.toString(),
        name: room.name,
        capacity: room.capacity
      },
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      bookings,
      occupancyRate: parseFloat(occupancyRate.toFixed(2))
    };
  } catch (error: unknown) {
    console.error('Error getting room occupancy:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Unknown error occurred while getting room occupancy');
  }
};

// Helper function to calculate business hours
const calculateBusinessHours = (start: Date, end: Date): number => {
  const OPENING_HOUR = 9;
  const CLOSING_HOUR = 18;
  
  let totalHours = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  
  const endDate = new Date(end);
  endDate.setHours(23, 59, 59, 999);
  
  while (current <= endDate) {
    // Skip weekends (optional)
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
      totalHours += (CLOSING_HOUR - OPENING_HOUR);
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return totalHours;
};

// Additional utility function: Get busiest times for a room
export const getBusiestTimes = async (
  roomId: string,
  startDate: string,
  endDate: string
): Promise<{
  room: { id: string; name: string };
  dateRange: { start: string; end: string };
  hourlyDistribution: Array<{ hour: number; count: number; percentage: number }>;
  peakHour: number;
}> => {
  try {
    const { 
      roomId: validatedRoomId, 
      startDate: validatedStartDate, 
      endDate: validatedEndDate 
    } = occupancySchema.parse({ roomId, startDate, endDate });

    const start = validateDateString(validatedStartDate + 'T00:00:00.000Z');
    const end = validateDateString(validatedEndDate + 'T23:59:59.999Z');

    const room = await Room.findById(validatedRoomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const bookings = await BookingModel.find({
      roomId: validatedRoomId,
      startTime: { $gte: start },
      endTime: { $lte: end },
      status: 'confirmed'
    }).lean() as Booking[];

    // Initialize hourly distribution
    const hourlyDistribution: Array<{ hour: number; count: number; percentage: number }> = [];
    for (let hour = 0; hour < 24; hour++) {
      hourlyDistribution[hour] = { hour, count: 0, percentage: 0 };
    }

    // Count bookings per hour
    bookings.forEach(booking => {
      const startHour = booking.startTime.getHours();
      const endHour = booking.endTime.getHours();
      
      for (let hour = startHour; hour < endHour; hour++) {
        if (hour >= 0 && hour < 24) {
          hourlyDistribution[hour].count++;
        }
      }
    });

    // Calculate percentages
    const totalCount = hourlyDistribution.reduce((sum, item) => sum + item.count, 0);
    hourlyDistribution.forEach(item => {
      item.percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;
    });

    // Find peak hour
    const peakHour = hourlyDistribution.reduce(
      (max, item, index) => item.count > max.count ? { ...item, hour: index } : max,
      { hour: 0, count: 0, percentage: 0 }
    ).hour;

    return {
      room: {
        id: room._id.toString(),
        name: room.name
      },
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      hourlyDistribution,
      peakHour
    };
  } catch (error: unknown) {
    console.error('Error getting busiest times:', error);
    throw error instanceof Error ? error : new Error('Unknown error occurred');
  }
};