import BookingModel from '../models/booking.model';
import { Booking } from '../types/index';
import Room from '../models/room.model';
import User from '../models/user.model';
import { 
  isDateInPast, 
  isOverlapping, 
  isValidBookingDuration 
} from '../utils/date.util';
import mongoose from 'mongoose';

interface CreateBookingData {
  roomId: string;
  startTime: Date;
  endTime: Date;
}

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
   booking.populate('roomId', 'name capacity amenities');
   booking.populate('userId', 'name email');
  
  return booking;
};

export const rescheduleBooking = async (
  bookingId: string,
  newTimes: { startTime: Date; endTime: Date },
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
  if (existingBooking.userId.toString() !== userId && !(await isAdmin(userId))) {
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

  return existingBooking;
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
  if (booking.userId.toString() !== userId && !(await isAdmin(userId))) {
    throw new Error('Not authorized to cancel this booking');
  }

  // Check if booking can be cancelled (not in the past)
  if (isDateInPast(booking.startTime)) {
    throw new Error('Cannot cancel a past booking');
  }

  booking.status = 'cancelled';
  await booking.save();

  booking.populate('roomId', 'name');
  booking.populate('userId', 'name email');

  return booking;
};

export const getBookingsByUserId = async (
  userId: string,
  options: { 
    status?: string; 
    limit?: number; 
    page?: number 
  } = {}
): Promise<Booking[]> => {
  const { status, limit = 50, page = 1 } = options;
  const skip = (page - 1) * limit;

  const query: any = { userId };
  
  if (status) {
    query.status = status;
  }

  const bookings = await BookingModel.find(query)
    .sort({ startTime: -1 })
    .skip(skip)
    .limit(limit)
    .populate('roomId', 'name capacity amenities')
    .populate('userId', 'name email');

  return bookings;
};

export const getBookingsByRoomId = async (
  roomId: string,
  options: { 
    fromDate?: Date; 
    toDate?: Date;
    status?: string;
    limit?: number;
    page?: number;
  } = {}
): Promise<Booking[]> => {
  const { 
    fromDate, 
    toDate, 
    status, 
    limit = 50, 
    page = 1 
  } = options;
  const skip = (page - 1) * limit;

  const query: any = { roomId };
  
  if (status) {
    query.status = status;
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
    .populate('userId', 'name email');

  return bookings;
};

export const getBookingById = async (
  bookingId: string
): Promise<Booking | null> => {
  const booking = await BookingModel.findById(bookingId)
    .populate('roomId', 'name capacity amenities')
    .populate('userId', 'name email role');
  
  return booking;
};

export const getAllBookings = async (
  options: {
    status?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    page?: number;
  } = {}
): Promise<Booking[]> => {
  const { 
    status, 
    fromDate, 
    toDate, 
    limit = 50, 
    page = 1 
  } = options;
  const skip = (page - 1) * limit;

  const query: any = {};
  
  if (status) {
    query.status = status;
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
    .populate('userId', 'name email');

  return bookings;
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
    .populate('userId', 'name email');

  return bookings;
};

export const checkRoomAvailability = async (
  roomId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
): Promise<boolean> => {
  const query: any = {
    roomId,
    status: { $in: ['confirmed', 'active', 'pending'] },
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
    ]
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const overlappingBookings = await BookingModel.find(query);
  return overlappingBookings.length === 0;
};

// Helper function to check if user is admin
const isAdmin = async (userId: string): Promise<boolean> => {
  const user = await User.findById(userId).select('role');
  return user?.role === 'admin';
};