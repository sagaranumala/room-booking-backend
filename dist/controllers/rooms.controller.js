"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoomAvailabilityBySlots = exports.getRoomAvailabilityByDate = exports.getRoomBookings = exports.checkAvailability = exports.deleteRoomPermanent = exports.activateRoom = exports.deactivateRoom = exports.updateRoom = exports.getRoomById = exports.getAllRooms = exports.createRoom = void 0;
const zod_1 = require("zod");
const room_model_1 = __importDefault(require("../models/room.model"));
const booking_model_1 = __importDefault(require("../models/booking.model"));
const date_util_1 = require("../utils/date.util");
// -------------------- Zod Schemas --------------------
const createRoomSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required"),
    capacity: zod_1.z.number().int().positive("Capacity must be a positive number"),
    description: zod_1.z.string().optional(),
    amenities: zod_1.z.array(zod_1.z.string()).optional(),
});
const updateRoomSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    capacity: zod_1.z.number().int().positive().optional(),
    description: zod_1.z.string().optional(),
    amenities: zod_1.z.array(zod_1.z.string()).optional(),
    isActive: zod_1.z.boolean().optional(),
});
const dateQuerySchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
    roomId: zod_1.z.string().optional(),
    showAll: zod_1.z.string().optional(),
});
// -------------------- ROOM CRUD --------------------
// Create Room
const createRoom = async (req, res) => {
    try {
        const parsed = createRoomSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: parsed.error
            });
        }
        const { name, capacity, description, amenities } = parsed.data;
        const existingRoom = await room_model_1.default.findOne({ name });
        if (existingRoom) {
            return res.status(409).json({
                success: false,
                message: 'Room with this name already exists'
            });
        }
        const newRoom = await room_model_1.default.create({
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
    }
    catch (error) {
        console.error('Create room error:', error);
        if (error instanceof Error) {
            const mongoError = error;
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
exports.createRoom = createRoom;
// Get All Rooms
const getAllRooms = async (req, res) => {
    try {
        const activeOnly = req.query.activeOnly === 'true';
        const query = activeOnly ? { isActive: true } : {};
        const rooms = await room_model_1.default.find(query).sort({ name: 1 });
        return res.status(200).json({
            success: true,
            data: rooms,
            count: rooms.length
        });
    }
    catch (error) {
        console.error('Get all rooms error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({
            success: false,
            message: 'Error fetching rooms',
            error: errorMessage
        });
    }
};
exports.getAllRooms = getAllRooms;
// Get Room By ID
const getRoomById = async (req, res) => {
    try {
        const { id } = req.params;
        const room = await room_model_1.default.findById(id);
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
    }
    catch (error) {
        console.error('Get room by ID error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({
            success: false,
            message: 'Error fetching room',
            error: errorMessage
        });
    }
};
exports.getRoomById = getRoomById;
// Update Room
const updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const parsed = updateRoomSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: parsed.error
            });
        }
        const room = await room_model_1.default.findById(id);
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
    }
    catch (error) {
        console.error('Update room error:', error);
        if (error instanceof Error) {
            const mongoError = error;
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
exports.updateRoom = updateRoom;
// Deactivate Room
const deactivateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const room = await room_model_1.default.findById(id);
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
    }
    catch (error) {
        console.error("Deactivate room error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({
            success: false,
            message: "Error deactivating room",
            error: errorMessage
        });
    }
};
exports.deactivateRoom = deactivateRoom;
// Activate Room
const activateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const room = await room_model_1.default.findById(id);
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
    }
    catch (error) {
        console.error("Activate room error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({
            success: false,
            message: "Error activating room",
            error: errorMessage
        });
    }
};
exports.activateRoom = activateRoom;
// Permanent Delete Room
const deleteRoomPermanent = async (req, res) => {
    try {
        const { id } = req.params;
        const room = await room_model_1.default.findById(id);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }
        await room_model_1.default.findByIdAndDelete(id);
        return res.status(200).json({
            success: true,
            message: "Room permanently deleted"
        });
    }
    catch (error) {
        console.error("Permanent delete error:", error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({
            success: false,
            message: "Error deleting room",
            error: errorMessage
        });
    }
};
exports.deleteRoomPermanent = deleteRoomPermanent;
// -------------------- ROOM AVAILABILITY --------------------
// Check Availability for a room or all rooms
const checkAvailability = async (req, res) => {
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
        const query = {
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
            const room = await room_model_1.default.findById(roomId);
            if (!room || !room.isActive) {
                return res.status(404).json({
                    success: false,
                    message: 'Room not found or inactive'
                });
            }
            const bookings = await booking_model_1.default.find(query).sort({ startTime: 1 });
            const availableSlots = (0, date_util_1.calculateAvailableSlots)(bookings, targetDate, 9, 18, 30);
            return res.status(200).json({
                success: true,
                data: {
                    room: {
                        id: room._id,
                        name: room.name,
                        capacity: room.capacity,
                        amenities: room.amenities
                    },
                    date: (0, date_util_1.formatDateToYYYYMMDD)(targetDate),
                    availableSlots: availableSlots.map(slot => ({
                        start: slot.start.toISOString(),
                        end: slot.end.toISOString(),
                        durationMinutes: slot.durationMinutes
                    })),
                    totalAvailableSlots: availableSlots.length
                }
            });
        }
        else {
            const activeRooms = await room_model_1.default.find({ isActive: true });
            const allBookings = await booking_model_1.default.find(query);
            const availability = activeRooms.map(room => {
                const roomBookings = allBookings.filter(booking => booking.roomId.toString() === room._id.toString());
                const availableSlots = (0, date_util_1.calculateAvailableSlots)(roomBookings, targetDate);
                return {
                    room: {
                        id: room._id,
                        name: room.name,
                        capacity: room.capacity,
                        amenities: room.amenities
                    },
                    date: (0, date_util_1.formatDateToYYYYMMDD)(targetDate),
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
                date: (0, date_util_1.formatDateToYYYYMMDD)(targetDate),
                totalRooms: filteredAvailability.length,
                roomsWithAvailability: filteredAvailability.filter(room => room.totalAvailableSlots > 0).length
            });
        }
    }
    catch (error) {
        console.error('Check availability error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return res.status(500).json({
            success: false,
            message: 'Error checking availability',
            error: errorMessage
        });
    }
};
exports.checkAvailability = checkAvailability;
// -------------------- Zod Schemas --------------------
const getRoomBookingsSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
});
const roomIdParamSchema = zod_1.z.object({
    roomId: zod_1.z.string().min(1, "Room ID is required"),
});
const getRoomAvailabilityByDateSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
});
// -------------------- Get Room Bookings --------------------
const getRoomBookings = async (req, res) => {
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
        const room = await room_model_1.default.findById(roomId);
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
        const bookings = await booking_model_1.default.find({
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
            date: (0, date_util_1.formatDateToYYYYMMDD)(targetDate),
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
    }
    catch (error) {
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
exports.getRoomBookings = getRoomBookings;
// -------------------- Get Room Availability By Date --------------------
const getRoomAvailabilityByDate = async (req, res) => {
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
        const activeRooms = await room_model_1.default.find({ isActive: true });
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
        const bookings = await booking_model_1.default.find({
            startTime: { $gte: startOfRange, $lt: endDate },
            status: { $in: ["confirmed", "pending"] },
        });
        const availability = activeRooms.map((room) => {
            const roomBookings = bookings.filter((b) => b.roomId.toString() === room._id.toString());
            // Generate day-wise availability
            const availableSlots = [];
            for (let i = 0; i < DAYS_RANGE; i++) {
                const currentDate = new Date(targetDate);
                currentDate.setDate(targetDate.getDate() + i);
                currentDate.setHours(0, 0, 0, 0);
                const dayStart = new Date(currentDate);
                const dayEnd = new Date(currentDate);
                dayEnd.setHours(23, 59, 59, 999);
                const bookingsForDay = roomBookings.filter((b) => b.startTime >= dayStart && b.startTime <= dayEnd);
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
    }
    catch (error) {
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
exports.getRoomAvailabilityByDate = getRoomAvailabilityByDate;
// -------------------- Zod Schemas --------------------
const getRoomAvailabilityBySlotsSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
});
// -------------------- Get Room Availability By Slots --------------------
const getRoomAvailabilityBySlots = async (req, res) => {
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
        const activeRooms = await room_model_1.default.find({ isActive: true });
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
        const bookings = await booking_model_1.default.find({
            startTime: { $gte: startOfDay, $lt: endOfDay },
            status: { $in: ["confirmed", "pending"] },
        });
        const availability = activeRooms.map((room) => {
            const roomBookings = bookings.filter((booking) => booking.roomId.toString() === room._id.toString());
            // Calculate available slots
            const availableSlotsRaw = (0, date_util_1.calculateAvailableSlots)(roomBookings, targetDate, 9, 18, 30);
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
    }
    catch (error) {
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
exports.getRoomAvailabilityBySlots = getRoomAvailabilityBySlots;
