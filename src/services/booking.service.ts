import BookingModel from '../models/booking.model';
import { Booking } from '../types/index';
import Room from '../models/room.model';
import User from '../models/user.model';
import { BookingStatus } from '../types/index';
import { 
  isDateInPast, 
  isValidBookingDuration 
} from '../utils/date.util';
import mongoose, { FilterQuery, Types } from 'mongoose';

// -------------------- Interfaces --------------------
interface CreateBookingData {
  roomId: string;
  startTime: Date;
  endTime: Date;
}

interface RescheduleBookingData {
  startTime: Date;
  endTime: Date;
}

interface BookingQueryOptions {
  status?: string;
  limit?: number;
  page?: number;
}

interface RoomBookingsQueryOptions extends BookingQueryOptions {
  fromDate?: Date;
  toDate?: Date;
}

// -------------------- Main Functions --------------------

export const createBooking = async (
  bookingData: CreateBookingData, 
  userId: string
): Promise<Booking> => {
  const { roomId, startTime, endTime } = bookingData;
  
  // Validate input
  if (!roomId || !startTime || !endTime) {
    throw new Error('Missing required fields: roomId, startTime, endTime');
  }

  if (startTime >= endTime) {
    throw new Error('Start time must be before end time');
  }

  if (!isValidBookingDuration(startTime, endTime)) {
    throw new Error('Booking duration cannot exceed 24 hours');
  }

  if (isDateInPast(startTime)) {
    throw new Error('Cannot book a room in the past');
  }

  // Check if room exists and is active
  const room = await Room.findById(roomId);
  if (!room) {
    throw new Error('Room not found');
  }

  if (!room.isActive) {
    throw new Error('Room is not available for booking');
  }

  // Check for overlapping bookings
  const overlappingBookings = await BookingModel.find({
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
  const booking = new BookingModel({
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
  
  return booking.toObject() as Booking;
};

export const rescheduleBooking = async (
  bookingId: string,
  newTimes: RescheduleBookingData,
  userId: string
): Promise<Booking> => {
  const { startTime, endTime } = newTimes;

  // Validate input
  if (startTime >= endTime) {
    throw new Error('Start time must be before end time');
  }

  if (!isValidBookingDuration(startTime, endTime)) {
    throw new Error('Booking duration cannot exceed 24 hours');
  }

  if (isDateInPast(startTime)) {
    throw new Error('Cannot reschedule to a past time');
  }

  // Find existing booking
  const existingBooking = await BookingModel.findById(bookingId);
  if (!existingBooking) {
    throw new Error('Booking not found');
  }

  // Check authorization
  const isUserAdmin = await checkUserIsAdmin(userId);
  if (existingBooking.userId.toString() !== userId && !isUserAdmin) {
    throw new Error('Not authorized to reschedule this booking');
  }

  // Check if booking can be rescheduled (not in the past)
  if (isDateInPast(existingBooking.startTime)) {
    throw new Error('Cannot reschedule a past booking');
  }

  // Check for overlapping bookings (excluding current booking)
  const overlappingBookings = await BookingModel.find({
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

  return existingBooking.toObject() as Booking;
};

export const cancelBooking = async (
  bookingId: string,
  userId: string
): Promise<Booking> => {
  const booking = await BookingModel.findById(bookingId);
  
  if (!booking) {
    throw new Error('Booking not found');
  }

  // Check authorization
  const isUserAdmin = await checkUserIsAdmin(userId);
  if (booking.userId.toString() !== userId && !isUserAdmin) {
    throw new Error('Not authorized to cancel this booking');
  }

  // Check if booking can be cancelled (not in the past)
  if (isDateInPast(booking.startTime)) {
    throw new Error('Cannot cancel a past booking');
  }

  booking.status = 'cancelled';
  await booking.save();

  await booking.populate('roomId', 'name');
  await booking.populate('userId', 'name email');

  return booking.toObject() as Booking;
};

export const getBookingsByUserId = async (
  userId: string,
  options: BookingQueryOptions = {}
): Promise<Booking[]> => {
  const { status, limit = 50, page = 1 } = options;
  const skip = (page - 1) * limit;

  const query: FilterQuery<Booking> = { userId };
  
  if (status) {
    query.status = status as BookingStatus;
  }

  const bookings = await BookingModel.find(query)
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(limit)
    .populate('roomId', 'name capacity amenities')
    .populate('userId', 'name email')
    .lean();

  return bookings as Booking[];
};

export const getBookingsByRoomId = async (
  roomId: string,
  options: RoomBookingsQueryOptions = {}
): Promise<Booking[]> => {
  const { 
    fromDate, 
    toDate, 
    status, 
    limit = 50, 
    page = 1 
  } = options;
  const skip = (page - 1) * limit;

  const query: FilterQuery<Booking> = { roomId };
  
  if (status) {
    query.status = status as BookingStatus;
  }

  if (fromDate && toDate) {
    query.startTime = { $gte: fromDate };
    query.endTime = { $lte: toDate };
  } else if (fromDate) {
    query.startTime = { $gte: fromDate };
  } else if (toDate) {
    query.endTime = { $lte: toDate };
  }

  const bookings = await BookingModel.find(query)
    .sort({ startTime: 1 })
    .skip(skip)
    .limit(limit)
    .populate('roomId', 'name capacity')
    .populate('userId', 'name email')
    .lean();

  return bookings as Booking[];
};

export const getBookingById = async (
  bookingId: string
): Promise<Booking | null> => {
  const booking = await BookingModel.findById(bookingId)
    .populate('roomId', 'name capacity amenities')
    .populate('userId', 'name email role')
    .lean();
  
  return booking as Booking | null;
};

export const getAllBookings = async (
  options: RoomBookingsQueryOptions = {}
): Promise<Booking[]> => {
  const { 
    status, 
    fromDate, 
    toDate, 
    limit = 50, 
    page = 1 
  } = options;
  const skip = (page - 1) * limit;

  const query: FilterQuery<Booking> = {};
  
  if (status) {
    query.status = status as BookingStatus;
  }

  if (fromDate && toDate) {
    query.startTime = { $gte: fromDate };
    query.endTime = { $lte: toDate };
  } else if (fromDate) {
    query.startTime = { $gte: fromDate };
  } else if (toDate) {
    query.endTime = { $lte: toDate };
  }

  const bookings = await BookingModel.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('roomId', 'name capacity')
    .populate('userId', 'name email')
    .lean();

  return bookings as Booking[];
};

export const getBookingsForRoom = async (
  roomId: string,
  date: string
): Promise<Booking[]> => {
  const startOfDay = new Date(date + 'T00:00:00.000Z');
  const endOfDay = new Date(date + 'T23:59:59.999Z');

  const bookings = await BookingModel.find({
    roomId,
    status: { $in: ['confirmed', 'active'] },
    startTime: { $gte: startOfDay },
    endTime: { $lte: endOfDay }
  })
    .sort({ startTime: 1 })
    .populate('userId', 'name email')
    .lean();

  return bookings as Booking[];
};

export const checkRoomAvailability = async (
  roomId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
): Promise<boolean> => {
  const query: FilterQuery<Booking> = {
    roomId,
    status: { $in: ['confirmed', 'active', 'pending'] },
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: new Types.ObjectId(excludeBookingId) };
  }

  const overlappingBookings = await BookingModel.find(query);
  return overlappingBookings.length === 0;
};

// -------------------- Helper Functions --------------------

const checkUserIsAdmin = async (userId: string): Promise<boolean> => {
  const user = await User.findById(userId).select('role').lean();
  return user?.role === 'admin';
};

// -------------------- Additional Utility Functions --------------------

export const getUpcomingBookings = async (
  userId: string,
  limit: number = 10
): Promise<Booking[]> => {
  const now = new Date();
  
  const bookings = await BookingModel.find({
    userId,
    startTime: { $gte: now },
    status: { $in: ['confirmed', 'pending'] }
  })
    .sort({ startTime: 1 })
    .limit(limit)
    .populate('roomId', 'name capacity')
    .lean();

  return bookings as Booking[];
};

export const getPastBookings = async (
  userId: string,
  limit: number = 10
): Promise<Booking[]> => {
  const now = new Date();
  
  const bookings = await BookingModel.find({
    userId,
    endTime: { $lt: now },
    status: 'confirmed'
  })
    .sort({ endTime: -1 })
    .limit(limit)
    .populate('roomId', 'name')
    .lean();

  return bookings as Booking[];
};

export const getBookingStats = async (
  userId?: string
): Promise<{
  total: number;
  upcoming: number;
  past: number;
  cancelled: number;
}> => {
  const now = new Date();
  
  const matchStage: Record<string, unknown> = {};
  if (userId) {
    matchStage.userId = new Types.ObjectId(userId);
  }

  const stats = await BookingModel.aggregate([
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

// Check if a booking time conflicts with any existing booking
export const checkBookingConflict = async (
  roomId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
): Promise<{
  hasConflict: boolean;
  conflictingBookings: Booking[];
}> => {
  const query: FilterQuery<Booking> = {
    roomId,
    status: { $in: ['confirmed', 'active', 'pending'] },
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: new Types.ObjectId(excludeBookingId) };
  }

  const conflictingBookings = await BookingModel.find(query)
    .populate('userId', 'name email')
    .lean();

  return {
    hasConflict: conflictingBookings.length > 0,
    conflictingBookings: conflictingBookings as Booking[]
  };
};