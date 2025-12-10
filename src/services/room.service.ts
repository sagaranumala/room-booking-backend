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

import Room from '../models/room.model';
import BookingModel from '../models/booking.model';
import { calculateAvailableSlots, formatDateToYYYYMMDD } from '../utils/date.util';
import { Booking, RoomAvailability, AvailableSlotResponse } from '../types/index'

// Get bookings for a room on a specific date
export const getBookingsForRoom = async (
  roomId: string, 
  date: string
): Promise<Booking[]> => {
  try {
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');

    const bookings = await BookingModel.find({
      roomId,
      startTime: { $gte: startOfDay },
      endTime: { $lte: endOfDay },
      status: { $in: ['confirmed', 'pending'] } // Only active bookings
    }).sort({ startTime: 1 });

    return bookings;
  } catch (error) {
    console.error(`Error fetching bookings for room ${roomId} on ${date}:`, error);
    throw error;
  }
};

// Check availability for all rooms on a specific date
export const checkRoomAvailability = async (
  date: string,
  options: {
    openingHour?: number;
    closingHour?: number;
    slotDuration?: number;
    includeInactiveRooms?: boolean;
  } = {}
): Promise<RoomAvailability[]> => {
  try {
    const {
      openingHour = 9,
      closingHour = 18,
      slotDuration = 30,
      includeInactiveRooms = false
    } = options;

    // Validate date
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    // Build room query
    const roomQuery: any = {};
    if (!includeInactiveRooms) {
      roomQuery.isActive = true;
    }

    // Fetch all rooms
    const rooms = await Room.find(roomQuery).sort({ name: 1 });

    // Fetch all bookings for the date (more efficient than per-room queries)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const allBookings = await BookingModel.find({
      startTime: { $gte: startOfDay },
      endTime: { $lte: endOfDay },
      status: { $in: ['confirmed', 'pending'] }
    }).sort({ startTime: 1 });

    const availableRooms: RoomAvailability[] = [];

    // Process each room
    for (const room of rooms) {
      // Filter bookings for this specific room
      const roomBookings = allBookings.filter(
        booking => booking.roomId.toString() === room._id.toString()
      );

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
        startTime: slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        endTime: slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }));

      // Add room to results
      availableRooms.push({
        room: {
          id: room._id.toString(),
          name: room.name,
          capacity: room.capacity,
          amenities: room.amenities,
          description: room.description
        },
        date: formatDateToYYYYMMDD(targetDate),
        availableSlots: formattedSlots,
        totalAvailableSlots: formattedSlots.length,
        isAvailable: formattedSlots.length > 0,
        totalBookings: roomBookings.length,
        nextAvailableSlot: formattedSlots.length > 0 ? formattedSlots[0].start : null,
        lastAvailableSlot: formattedSlots.length > 0 ? formattedSlots[formattedSlots.length - 1].start : null
      });
    }

    return availableRooms;
  } catch (error) {
    console.error('Error checking room availability:', error);
    throw error;
  }
};

// Check availability for a specific room
export const checkSingleRoomAvailability = async (
  roomId: string,
  date: string,
  options: {
    openingHour?: number;
    closingHour?: number;
    slotDuration?: number;
  } = {}
): Promise<RoomAvailability | null> => {
  try {
    const {
      openingHour = 9,
      closingHour = 18,
      slotDuration = 30
    } = options;

    // Validate date
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }

    // Check if room exists and is active
    const room = await Room.findById(roomId);
    if (!room || !room.isActive) {
      throw new Error('Room not found or inactive');
    }

    // Get bookings for the room on the specified date
    const bookings = await getBookingsForRoom(roomId, date);

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
      startTime: slot.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: slot.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    return {
      room: {
        id: room._id.toString(),
        name: room.name,
        capacity: room.capacity,
        amenities: room.amenities,
        description: room.description
      },
      date: formatDateToYYYYMMDD(targetDate),
      availableSlots: formattedSlots,
      totalAvailableSlots: formattedSlots.length,
      isAvailable: formattedSlots.length > 0,
      totalBookings: bookings.length,
      nextAvailableSlot: formattedSlots.length > 0 ? formattedSlots[0].start : null,
      lastAvailableSlot: formattedSlots.length > 0 ? formattedSlots[formattedSlots.length - 1].start : null
    };
  } catch (error) {
    console.error(`Error checking availability for room ${roomId}:`, error);
    throw error;
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
    const query: any = {
      roomId,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      status: { $in: ['confirmed', 'pending'] }
    };

    // Exclude current booking when checking for rescheduling
    if (excludeBookingId) {
      query._id = { $ne: excludeBookingId };
    }

    const conflictingBookings = await BookingModel.find(query);

    return conflictingBookings.length === 0;
  } catch (error) {
    console.error('Error checking time slot availability:', error);
    throw error;
  }
};

// Get room occupancy for a date range
export const getRoomOccupancy = async (
  roomId: string,
  startDate: string,
  endDate: string
): Promise<{
  room: any;
  dateRange: { start: string; end: string };
  bookings: Booking[];
  occupancyRate: number;
}> => {
  try {
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T23:59:59.999Z');

    const room = await Room.findById(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    const bookings = await BookingModel.find({
      roomId,
      startTime: { $gte: start },
      endTime: { $lte: end },
      status: 'confirmed'
    }).sort({ startTime: 1 });

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
  } catch (error) {
    console.error('Error getting room occupancy:', error);
    throw error;
  }
};

// Helper function to calculate business hours
const calculateBusinessHours = (start: Date, end: Date): number => {
  const openingHour = 9;
  const closingHour = 18;
  
  let totalHours = 0;
  const current = new Date(start);
  
  while (current <= end) {
    // Skip weekends (optional)
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
      totalHours += (closingHour - openingHour);
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return totalHours;
};
