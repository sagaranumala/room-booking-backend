"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBookingConflict = exports.getBookingStats = exports.getPastBookings = exports.getUpcomingBookings = exports.checkRoomAvailability = exports.getBookingsForRoom = exports.getAllBookings = exports.getBookingById = exports.getBookingsByRoomId = exports.getBookingsByUserId = exports.cancelBooking = exports.rescheduleBooking = exports.createBooking = void 0;
const booking_model_1 = __importDefault(require("../models/booking.model"));
const room_model_1 = __importDefault(require("../models/room.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const date_util_1 = require("../utils/date.util");
const mongoose_1 = require("mongoose");
// -------------------- Main Functions --------------------
const createBooking = async (bookingData, userId) => {
    const { roomId, startTime, endTime } = bookingData;
    // Validate input
    if (!roomId || !startTime || !endTime) {
        throw new Error('Missing required fields: roomId, startTime, endTime');
    }
    if (startTime >= endTime) {
        throw new Error('Start time must be before end time');
    }
    if (!(0, date_util_1.isValidBookingDuration)(startTime, endTime)) {
        throw new Error('Booking duration cannot exceed 24 hours');
    }
    if ((0, date_util_1.isDateInPast)(startTime)) {
        throw new Error('Cannot book a room in the past');
    }
    // Check if room exists and is active
    const room = await room_model_1.default.findById(roomId);
    if (!room) {
        throw new Error('Room not found');
    }
    if (!room.isActive) {
        throw new Error('Room is not available for booking');
    }
    // Check for overlapping bookings
    const overlappingBookings = await booking_model_1.default.find({
        roomId,
        status: { $in: ['confirmed', 'active', 'pending'] },
        $or: [
            { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
        ]
    });
    if (overlappingBookings.length > 0) {
        throw new Error('Room is already booked during this time');
    }
    // Create booking
    const booking = new booking_model_1.default({
        roomId,
        userId,
        startTime,
        endTime,
        status: 'confirmed'
    });
    await booking.save();
    // Populate room details
    await booking.populate('roomId', 'name capacity amenities');
    await booking.populate('userId', 'name email');
    return booking.toObject();
};
exports.createBooking = createBooking;
const rescheduleBooking = async (bookingId, newTimes, userId) => {
    const { startTime, endTime } = newTimes;
    // Validate input
    if (startTime >= endTime) {
        throw new Error('Start time must be before end time');
    }
    if (!(0, date_util_1.isValidBookingDuration)(startTime, endTime)) {
        throw new Error('Booking duration cannot exceed 24 hours');
    }
    if ((0, date_util_1.isDateInPast)(startTime)) {
        throw new Error('Cannot reschedule to a past time');
    }
    // Find existing booking
    const existingBooking = await booking_model_1.default.findById(bookingId);
    if (!existingBooking) {
        throw new Error('Booking not found');
    }
    // Check authorization
    const isUserAdmin = await checkUserIsAdmin(userId);
    if (existingBooking.userId.toString() !== userId && !isUserAdmin) {
        throw new Error('Not authorized to reschedule this booking');
    }
    // Check if booking can be rescheduled (not in the past)
    if ((0, date_util_1.isDateInPast)(existingBooking.startTime)) {
        throw new Error('Cannot reschedule a past booking');
    }
    // Check for overlapping bookings (excluding current booking)
    const overlappingBookings = await booking_model_1.default.find({
        roomId: existingBooking.roomId,
        _id: { $ne: existingBooking._id },
        status: { $in: ['confirmed', 'active', 'pending'] },
        $or: [
            { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
        ]
    });
    if (overlappingBookings.length > 0) {
        throw new Error('Room is already booked during this time');
    }
    // Update booking
    existingBooking.startTime = startTime;
    existingBooking.endTime = endTime;
    await existingBooking.save();
    await existingBooking.populate('roomId', 'name capacity');
    await existingBooking.populate('userId', 'name email');
    return existingBooking.toObject();
};
exports.rescheduleBooking = rescheduleBooking;
const cancelBooking = async (bookingId, userId) => {
    const booking = await booking_model_1.default.findById(bookingId);
    if (!booking) {
        throw new Error('Booking not found');
    }
    // Check authorization
    const isUserAdmin = await checkUserIsAdmin(userId);
    if (booking.userId.toString() !== userId && !isUserAdmin) {
        throw new Error('Not authorized to cancel this booking');
    }
    // Check if booking can be cancelled (not in the past)
    if ((0, date_util_1.isDateInPast)(booking.startTime)) {
        throw new Error('Cannot cancel a past booking');
    }
    booking.status = 'cancelled';
    await booking.save();
    await booking.populate('roomId', 'name');
    await booking.populate('userId', 'name email');
    return booking.toObject();
};
exports.cancelBooking = cancelBooking;
const getBookingsByUserId = async (userId, options = {}) => {
    const { status, limit = 50, page = 1 } = options;
    const skip = (page - 1) * limit;
    const query = { userId };
    if (status) {
        query.status = status;
    }
    const bookings = await booking_model_1.default.find(query)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit)
        .populate('roomId', 'name capacity amenities')
        .populate('userId', 'name email')
        .lean();
    return bookings;
};
exports.getBookingsByUserId = getBookingsByUserId;
const getBookingsByRoomId = async (roomId, options = {}) => {
    const { fromDate, toDate, status, limit = 50, page = 1 } = options;
    const skip = (page - 1) * limit;
    const query = { roomId };
    if (status) {
        query.status = status;
    }
    if (fromDate && toDate) {
        query.startTime = { $gte: fromDate };
        query.endTime = { $lte: toDate };
    }
    else if (fromDate) {
        query.startTime = { $gte: fromDate };
    }
    else if (toDate) {
        query.endTime = { $lte: toDate };
    }
    const bookings = await booking_model_1.default.find(query)
        .sort({ startTime: 1 })
        .skip(skip)
        .limit(limit)
        .populate('roomId', 'name capacity')
        .populate('userId', 'name email')
        .lean();
    return bookings;
};
exports.getBookingsByRoomId = getBookingsByRoomId;
const getBookingById = async (bookingId) => {
    const booking = await booking_model_1.default.findById(bookingId)
        .populate('roomId', 'name capacity amenities')
        .populate('userId', 'name email role')
        .lean();
    return booking;
};
exports.getBookingById = getBookingById;
const getAllBookings = async (options = {}) => {
    const { status, fromDate, toDate, limit = 50, page = 1 } = options;
    const skip = (page - 1) * limit;
    const query = {};
    if (status) {
        query.status = status;
    }
    if (fromDate && toDate) {
        query.startTime = { $gte: fromDate };
        query.endTime = { $lte: toDate };
    }
    else if (fromDate) {
        query.startTime = { $gte: fromDate };
    }
    else if (toDate) {
        query.endTime = { $lte: toDate };
    }
    const bookings = await booking_model_1.default.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('roomId', 'name capacity')
        .populate('userId', 'name email')
        .lean();
    return bookings;
};
exports.getAllBookings = getAllBookings;
const getBookingsForRoom = async (roomId, date) => {
    const startOfDay = new Date(date + 'T00:00:00.000Z');
    const endOfDay = new Date(date + 'T23:59:59.999Z');
    const bookings = await booking_model_1.default.find({
        roomId,
        status: { $in: ['confirmed', 'active'] },
        startTime: { $gte: startOfDay },
        endTime: { $lte: endOfDay }
    })
        .sort({ startTime: 1 })
        .populate('userId', 'name email')
        .lean();
    return bookings;
};
exports.getBookingsForRoom = getBookingsForRoom;
const checkRoomAvailability = async (roomId, startTime, endTime, excludeBookingId) => {
    const query = {
        roomId,
        status: { $in: ['confirmed', 'active', 'pending'] },
        $or: [
            { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
        ]
    };
    if (excludeBookingId) {
        query._id = { $ne: new mongoose_1.Types.ObjectId(excludeBookingId) };
    }
    const overlappingBookings = await booking_model_1.default.find(query);
    return overlappingBookings.length === 0;
};
exports.checkRoomAvailability = checkRoomAvailability;
// -------------------- Helper Functions --------------------
const checkUserIsAdmin = async (userId) => {
    const user = await user_model_1.default.findById(userId).select('role').lean();
    return user?.role === 'admin';
};
// -------------------- Additional Utility Functions --------------------
const getUpcomingBookings = async (userId, limit = 10) => {
    const now = new Date();
    const bookings = await booking_model_1.default.find({
        userId,
        startTime: { $gte: now },
        status: { $in: ['confirmed', 'pending'] }
    })
        .sort({ startTime: 1 })
        .limit(limit)
        .populate('roomId', 'name capacity')
        .lean();
    return bookings;
};
exports.getUpcomingBookings = getUpcomingBookings;
const getPastBookings = async (userId, limit = 10) => {
    const now = new Date();
    const bookings = await booking_model_1.default.find({
        userId,
        endTime: { $lt: now },
        status: 'confirmed'
    })
        .sort({ endTime: -1 })
        .limit(limit)
        .populate('roomId', 'name')
        .lean();
    return bookings;
};
exports.getPastBookings = getPastBookings;
const getBookingStats = async (userId) => {
    const now = new Date();
    const matchStage = {};
    if (userId) {
        matchStage.userId = new mongoose_1.Types.ObjectId(userId);
    }
    const stats = await booking_model_1.default.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                upcoming: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $gte: ["$startTime", now] },
                                    { $eq: ["$status", "confirmed"] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                },
                past: {
                    $sum: {
                        $cond: [
                            { $lt: ["$endTime", now] },
                            1,
                            0
                        ]
                    }
                },
                cancelled: {
                    $sum: {
                        $cond: [
                            { $eq: ["$status", "cancelled"] },
                            1,
                            0
                        ]
                    }
                }
            }
        }
    ]);
    return stats[0] || { total: 0, upcoming: 0, past: 0, cancelled: 0 };
};
exports.getBookingStats = getBookingStats;
// Check if a booking time conflicts with any existing booking
const checkBookingConflict = async (roomId, startTime, endTime, excludeBookingId) => {
    const query = {
        roomId,
        status: { $in: ['confirmed', 'active', 'pending'] },
        $or: [
            { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
        ]
    };
    if (excludeBookingId) {
        query._id = { $ne: new mongoose_1.Types.ObjectId(excludeBookingId) };
    }
    const conflictingBookings = await booking_model_1.default.find(query)
        .populate('userId', 'name email')
        .lean();
    return {
        hasConflict: conflictingBookings.length > 0,
        conflictingBookings: conflictingBookings
    };
};
exports.checkBookingConflict = checkBookingConflict;
