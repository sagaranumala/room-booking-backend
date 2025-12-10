"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAvailability = exports.getBooking = exports.getBookingsForRoomByDate = exports.getRoomBookings = exports.cancelUserBooking = exports.listAllBookingsGroupedByRoom = exports.listAllBookings = exports.listUserBookings = exports.rescheduleBooking = exports.createBooking = void 0;
const zod_1 = require("zod");
const booking_service_1 = require("../services/booking.service");
// -------------------- Zod Schemas --------------------
const createBookingSchema = zod_1.z.object({
    roomId: zod_1.z.string().min(1, "Room ID is required"),
    startTime: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid startTime date format",
    }),
    endTime: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid endTime date format",
    }),
});
const rescheduleBookingSchema = zod_1.z.object({
    startTime: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid startTime date format",
    }),
    endTime: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid endTime date format",
    }),
});
const bookingIdSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, "Booking ID is required"),
});
const userIdSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1, "User ID is required"),
});
const listUserBookingsSchema = zod_1.z.object({
    status: zod_1.z.string().optional(),
    limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
});
const listAllBookingsSchema = zod_1.z.object({
    status: zod_1.z.string().optional(),
    fromDate: zod_1.z.string()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid fromDate format",
    })
        .optional(),
    toDate: zod_1.z.string()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid toDate format",
    })
        .optional(),
    limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
});
const roomIdParamSchema = zod_1.z.object({
    roomId: zod_1.z.string().min(1, "Room ID is required"),
});
const getRoomBookingsSchema = zod_1.z.object({
    fromDate: zod_1.z.string()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid fromDate format",
    })
        .optional(),
    toDate: zod_1.z.string()
        .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Invalid toDate format",
    })
        .optional(),
    status: zod_1.z.string().optional(),
    limit: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
    page: zod_1.z.string().regex(/^\d+$/).transform(Number).optional(),
});
const getBookingsForRoomByDateSchema = zod_1.z.object({
    date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: "Date must be in YYYY-MM-DD format",
    }),
});
const checkAvailabilitySchema = zod_1.z.object({
    roomId: zod_1.z.string().min(1, "Room ID is required"),
    startTime: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid startTime date format",
    }),
    endTime: zod_1.z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid endTime date format",
    }),
    excludeBookingId: zod_1.z.string().optional(),
});
// ---------------------------
// Create Booking
// ---------------------------
const createBooking = async (req, res) => {
    try {
        const user = req.user;
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
        const booking = await (0, booking_service_1.createBooking)({
            roomId,
            startTime: new Date(startTime),
            endTime: new Date(endTime)
        }, user.id);
        return res.status(201).json({
            success: true,
            data: booking,
            message: 'Booking created successfully'
        });
    }
    catch (error) {
        console.error('Create booking error:', error);
        if (error instanceof Error) {
            const serviceError = error;
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
exports.createBooking = createBooking;
// ---------------------------
// Reschedule Booking
// ---------------------------
const rescheduleBooking = async (req, res) => {
    try {
        const user = req.user;
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
        const updatedBooking = await (0, booking_service_1.rescheduleBooking)(bookingId, {
            startTime: new Date(startTime),
            endTime: new Date(endTime)
        }, user.id);
        return res.status(200).json({
            success: true,
            data: updatedBooking,
            message: 'Booking rescheduled successfully'
        });
    }
    catch (error) {
        console.error('Reschedule booking error:', error);
        if (error instanceof Error) {
            const serviceError = error;
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
exports.rescheduleBooking = rescheduleBooking;
// ---------------------------
// List Bookings for Current User
// ---------------------------
const listUserBookings = async (req, res) => {
    try {
        const user = req.user;
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
        const options = {
            status,
            limit,
            page,
        };
        const bookings = await (0, booking_service_1.getBookingsByUserId)(user.id, options);
        return res.status(200).json({
            success: true,
            data: bookings,
            count: bookings.length,
            meta: {
                page: page || 1,
                limit: limit || bookings.length
            }
        });
    }
    catch (error) {
        console.error('List user bookings error:', error);
        if (error instanceof Error) {
            const serviceError = error;
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
exports.listUserBookings = listUserBookings;
// ---------------------------
// Admin: List All Bookings
// ---------------------------
const listAllBookings = async (req, res) => {
    try {
        const user = req.user;
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
        const options = {
            status,
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined,
            limit,
            page,
        };
        const bookings = await (0, booking_service_1.getAllBookings)(options);
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
    }
    catch (error) {
        console.error('List all bookings error:', error);
        if (error instanceof Error) {
            const serviceError = error;
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
exports.listAllBookings = listAllBookings;
// ---------------------------
// Admin: List All Bookings Grouped by Room
// ---------------------------
const listAllBookingsGroupedByRoom = async (req, res) => {
    try {
        const user = req.user;
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
        const options = {
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined,
            status: 'confirmed',
        };
        const bookings = await (0, booking_service_1.getAllBookings)(options);
        // Group by room
        const grouped = bookings.reduce((acc, booking) => {
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
    }
    catch (error) {
        console.error('List grouped bookings error:', error);
        if (error instanceof Error) {
            const serviceError = error;
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
exports.listAllBookingsGroupedByRoom = listAllBookingsGroupedByRoom;
// ---------------------------
// Cancel Booking
// ---------------------------
const cancelUserBooking = async (req, res) => {
    try {
        const user = req.user;
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
        const cancelledBooking = await (0, booking_service_1.cancelBooking)(bookingId, user.id);
        return res.status(200).json({
            success: true,
            data: cancelledBooking,
            message: 'Booking cancelled successfully'
        });
    }
    catch (error) {
        console.error('Cancel booking error:', error);
        if (error instanceof Error) {
            const serviceError = error;
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
exports.cancelUserBooking = cancelUserBooking;
// ---------------------------
// List Bookings by Room
// ---------------------------
const getRoomBookings = async (req, res) => {
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
        const options = {
            fromDate: fromDate ? new Date(fromDate) : undefined,
            toDate: toDate ? new Date(toDate) : undefined,
            status,
            limit,
            page,
        };
        const bookings = await (0, booking_service_1.getBookingsByRoomId)(roomId, options);
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
    }
    catch (error) {
        console.error('Get room bookings error:', error);
        if (error instanceof Error) {
            const serviceError = error;
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
exports.getRoomBookings = getRoomBookings;
// ---------------------------
// Get Bookings for Room on Specific Date
// ---------------------------
const getBookingsForRoomByDate = async (req, res) => {
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
        const bookings = await (0, booking_service_1.getBookingsForRoom)(roomId, date);
        return res.status(200).json({
            success: true,
            data: bookings,
            meta: {
                roomId,
                date,
                count: bookings.length
            }
        });
    }
    catch (error) {
        console.error('Get bookings for room by date error:', error);
        if (error instanceof Error) {
            const serviceError = error;
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
exports.getBookingsForRoomByDate = getBookingsForRoomByDate;
// ---------------------------
// Single Booking by ID
// ---------------------------
const getBooking = async (req, res) => {
    try {
        const bookingIdValidation = bookingIdSchema.safeParse(req.params);
        if (!bookingIdValidation.success) {
            return res.status(400).json({
                success: false,
                message: 'Invalid booking ID',
                errors: bookingIdValidation.error
            });
        }
        const user = req.user;
        const { id: bookingId } = bookingIdValidation.data;
        const booking = await (0, booking_service_1.getBookingById)(bookingId);
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
    }
    catch (error) {
        console.error('Get booking error:', error);
        if (error instanceof Error) {
            const serviceError = error;
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
exports.getBooking = getBooking;
// ---------------------------
// Check Room Availability
// ---------------------------
const checkAvailability = async (req, res) => {
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
        const isAvailable = await (0, booking_service_1.checkRoomAvailability)(roomId, new Date(startTime), new Date(endTime), excludeBookingId);
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
    }
    catch (error) {
        console.error('Check availability error:', error);
        if (error instanceof Error) {
            const serviceError = error;
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
exports.checkAvailability = checkAvailability;
