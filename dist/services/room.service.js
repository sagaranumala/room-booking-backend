"use strict";
// import Room from '../models/room.model';
// import { calculateAvailableSlots } from '../utils/date.util';
// import { getBookingsForRoom } from './booking.service';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBusiestTimes = exports.getRoomOccupancy = exports.isTimeSlotAvailable = exports.checkSingleRoomAvailability = exports.checkRoomAvailability = exports.getBookingsForRoom = void 0;
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
const zod_1 = require("zod");
const room_model_1 = __importDefault(require("../models/room.model"));
const booking_model_1 = __importDefault(require("../models/booking.model"));
const date_util_1 = require("../utils/date.util");
const mongoose_1 = require("mongoose");
// -------------------- Zod Schemas --------------------
const dateSchema = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Invalid date format. Use YYYY-MM-DD"
});
const roomIdSchema = zod_1.z.string().min(1, "Room ID is required");
const checkAvailabilitySchema = zod_1.z.object({
    date: dateSchema,
    openingHour: zod_1.z.number().min(0).max(23).optional(),
    closingHour: zod_1.z.number().min(1).max(24).optional(),
    slotDuration: zod_1.z.number().min(15).max(180).optional(),
    includeInactiveRooms: zod_1.z.boolean().optional(),
});
const singleRoomAvailabilitySchema = zod_1.z.object({
    date: dateSchema,
    openingHour: zod_1.z.number().min(0).max(23).optional(),
    closingHour: zod_1.z.number().min(1).max(24).optional(),
    slotDuration: zod_1.z.number().min(15).max(180).optional(),
});
const timeSlotAvailabilitySchema = zod_1.z.object({
    roomId: roomIdSchema,
    startTime: zod_1.z.date(),
    endTime: zod_1.z.date(),
    excludeBookingId: zod_1.z.string().optional(),
});
const occupancySchema = zod_1.z.object({
    roomId: roomIdSchema,
    startDate: dateSchema,
    endDate: dateSchema,
});
// -------------------- Helper Functions --------------------
function isValidDate(date) {
    return !isNaN(date.getTime());
}
function validateDateString(dateString) {
    const date = new Date(dateString);
    if (!isValidDate(date)) {
        throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    return date;
}
// -------------------- Main Functions --------------------
// Get bookings for a room on a specific date
const getBookingsForRoom = async (roomId, date) => {
    try {
        // Validate inputs
        const validatedRoomId = roomIdSchema.parse(roomId);
        const validatedDate = dateSchema.parse(date);
        const startOfDay = new Date(validatedDate + 'T00:00:00.000Z');
        const endOfDay = new Date(validatedDate + 'T23:59:59.999Z');
        const bookings = await booking_model_1.default.find({
            roomId: validatedRoomId,
            startTime: { $gte: startOfDay },
            endTime: { $lte: endOfDay },
            status: { $in: ['confirmed', 'pending'] }
        }).sort({ startTime: 1 }).lean();
        return bookings;
    }
    catch (error) {
        console.error(`Error fetching bookings for room ${roomId} on ${date}:`, error);
        if (error instanceof zod_1.z.ZodError) {
            throw new Error(`Validation error: ${error}`);
        }
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Unknown error occurred while fetching bookings');
    }
};
exports.getBookingsForRoom = getBookingsForRoom;
// Check availability for all rooms on a specific date
const checkRoomAvailability = async (date, options = {}) => {
    try {
        // Validate and parse options
        const validationResult = checkAvailabilitySchema.safeParse({
            date,
            ...options
        });
        if (!validationResult.success) {
            throw new Error(`Validation error: ${validationResult.error}`);
        }
        const { date: validatedDate, openingHour = 9, closingHour = 18, slotDuration = 30, includeInactiveRooms = false } = validationResult.data;
        // Validate date
        const targetDate = validateDateString(validatedDate);
        // Validate time constraints
        if (openingHour >= closingHour) {
            throw new Error('Opening hour must be before closing hour');
        }
        // Build room query
        const roomQuery = {};
        if (!includeInactiveRooms) {
            roomQuery.isActive = true;
        }
        // Fetch all rooms
        const rooms = await room_model_1.default.find(roomQuery).sort({ name: 1 });
        // Fetch all bookings for the date
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);
        const allBookings = await booking_model_1.default.find({
            startTime: { $gte: startOfDay },
            endTime: { $lte: endOfDay },
            status: { $in: ['confirmed', 'pending'] }
        }).sort({ startTime: 1 }).lean();
        const availableRooms = [];
        // Process each room
        for (const room of rooms) {
            // Filter bookings for this specific room
            const roomBookings = allBookings.filter(booking => booking.roomId.toString() === room._id.toString());
            // Calculate available slots
            const availableSlots = (0, date_util_1.calculateAvailableSlots)(roomBookings, targetDate, openingHour, closingHour, slotDuration);
            // Format slots for response
            const formattedSlots = availableSlots.map(slot => ({
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
                date: (0, date_util_1.formatDateToYYYYMMDD)(targetDate),
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
    }
    catch (error) {
        console.error('Error checking room availability:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Unknown error occurred while checking room availability');
    }
};
exports.checkRoomAvailability = checkRoomAvailability;
// Check availability for a specific room
const checkSingleRoomAvailability = async (roomId, date, options = {}) => {
    try {
        // Validate inputs
        const validationResult = singleRoomAvailabilitySchema.safeParse({
            date,
            ...options
        });
        if (!validationResult.success) {
            throw new Error(`Validation error: ${validationResult.error}`);
        }
        const { date: validatedDate, openingHour = 9, closingHour = 18, slotDuration = 30 } = validationResult.data;
        // Validate date
        const targetDate = validateDateString(validatedDate);
        // Validate time constraints
        if (openingHour >= closingHour) {
            throw new Error('Opening hour must be before closing hour');
        }
        // Check if room exists and is active
        const room = await room_model_1.default.findById(roomId);
        if (!room) {
            throw new Error('Room not found');
        }
        if (!room.isActive) {
            throw new Error('Room is inactive');
        }
        // Get bookings for the room on the specified date
        const bookings = await (0, exports.getBookingsForRoom)(roomId, validatedDate);
        // Calculate available slots
        const availableSlots = (0, date_util_1.calculateAvailableSlots)(bookings, targetDate, openingHour, closingHour, slotDuration);
        // Format slots for response
        const formattedSlots = availableSlots.map(slot => ({
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
            date: (0, date_util_1.formatDateToYYYYMMDD)(targetDate),
            availableSlots: formattedSlots,
            totalAvailableSlots: formattedSlots.length,
            isAvailable: formattedSlots.length > 0,
            totalBookings: bookings.length,
            nextAvailableSlot: formattedSlots.length > 0 ? formattedSlots[0].start : null,
            lastAvailableSlot: formattedSlots.length > 0
                ? formattedSlots[formattedSlots.length - 1].start
                : null
        };
    }
    catch (error) {
        console.error(`Error checking availability for room ${roomId}:`, error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Unknown error occurred while checking room availability');
    }
};
exports.checkSingleRoomAvailability = checkSingleRoomAvailability;
// Check if a specific time slot is available
const isTimeSlotAvailable = async (roomId, startTime, endTime, excludeBookingId) => {
    try {
        // Validate inputs
        const validationResult = timeSlotAvailabilitySchema.safeParse({
            roomId,
            startTime,
            endTime,
            excludeBookingId
        });
        if (!validationResult.success) {
            throw new Error(`Validation error: ${validationResult.error}`);
        }
        const { roomId: validatedRoomId, startTime: validatedStartTime, endTime: validatedEndTime, excludeBookingId: validatedExcludeBookingId } = validationResult.data;
        // Validate time order
        if (validatedStartTime >= validatedEndTime) {
            throw new Error('Start time must be before end time');
        }
        // Build query
        const query = {
            roomId: validatedRoomId,
            startTime: { $lt: validatedEndTime },
            endTime: { $gt: validatedStartTime },
            status: { $in: ['confirmed', 'pending'] }
        };
        // Exclude current booking when checking for rescheduling
        if (validatedExcludeBookingId) {
            query._id = { $ne: new mongoose_1.Types.ObjectId(validatedExcludeBookingId) };
        }
        const conflictingBookings = await booking_model_1.default.find(query);
        return conflictingBookings.length === 0;
    }
    catch (error) {
        console.error('Error checking time slot availability:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Unknown error occurred while checking time slot availability');
    }
};
exports.isTimeSlotAvailable = isTimeSlotAvailable;
// Get room occupancy for a date range
const getRoomOccupancy = async (roomId, startDate, endDate) => {
    try {
        // Validate inputs
        const validationResult = occupancySchema.safeParse({
            roomId,
            startDate,
            endDate
        });
        if (!validationResult.success) {
            throw new Error(`Validation error: ${validationResult.error}`);
        }
        const { roomId: validatedRoomId, startDate: validatedStartDate, endDate: validatedEndDate } = validationResult.data;
        // Validate dates
        const start = validateDateString(validatedStartDate + 'T00:00:00.000Z');
        const end = validateDateString(validatedEndDate + 'T23:59:59.999Z');
        // Validate date range
        if (start > end) {
            throw new Error('Start date must be before end date');
        }
        const room = await room_model_1.default.findById(validatedRoomId);
        if (!room) {
            throw new Error('Room not found');
        }
        const bookings = await booking_model_1.default.find({
            roomId: validatedRoomId,
            startTime: { $gte: start },
            endTime: { $lte: end },
            status: 'confirmed'
        })
            .sort({ startTime: 1 })
            .lean();
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
    }
    catch (error) {
        console.error('Error getting room occupancy:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Unknown error occurred while getting room occupancy');
    }
};
exports.getRoomOccupancy = getRoomOccupancy;
// Helper function to calculate business hours
const calculateBusinessHours = (start, end) => {
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
const getBusiestTimes = async (roomId, startDate, endDate) => {
    try {
        const { roomId: validatedRoomId, startDate: validatedStartDate, endDate: validatedEndDate } = occupancySchema.parse({ roomId, startDate, endDate });
        const start = validateDateString(validatedStartDate + 'T00:00:00.000Z');
        const end = validateDateString(validatedEndDate + 'T23:59:59.999Z');
        const room = await room_model_1.default.findById(validatedRoomId);
        if (!room) {
            throw new Error('Room not found');
        }
        const bookings = await booking_model_1.default.find({
            roomId: validatedRoomId,
            startTime: { $gte: start },
            endTime: { $lte: end },
            status: 'confirmed'
        }).lean();
        // Initialize hourly distribution
        const hourlyDistribution = [];
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
        const peakHour = hourlyDistribution.reduce((max, item, index) => item.count > max.count ? { ...item, hour: index } : max, { hour: 0, count: 0, percentage: 0 }).hour;
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
    }
    catch (error) {
        console.error('Error getting busiest times:', error);
        throw error instanceof Error ? error : new Error('Unknown error occurred');
    }
};
exports.getBusiestTimes = getBusiestTimes;
