// 

import { Booking } from '../types/index';

export interface TimeSlot {
  start: Date;
  end: Date;
}

export interface AvailableSlot {
  start: Date;
  end: Date;
  durationMinutes: number;
}

export const calculateAvailableSlots = (
  bookings: Booking[], 
  date: Date,
  openingHour: number = 9,
  closingHour: number = 18,
  slotDurationMinutes: number = 30
): AvailableSlot[] => {
  const slots: AvailableSlot[] = [];

  // Set the start and end of the day
  const dayStart = new Date(date);
  dayStart.setHours(openingHour, 0, 0, 0);
  
  const dayEnd = new Date(date);
  dayEnd.setHours(closingHour, 0, 0, 0);

  // Filter bookings for the specific day
  const dayBookings = bookings.filter(booking => {
    const bookingDate = new Date(booking.startTime);
    return bookingDate.toDateString() === date.toDateString();
  });

  // Convert bookings to time ranges
  const bookedRanges = dayBookings.map(booking => ({
    start: new Date(booking.startTime).getTime(),
    end: new Date(booking.endTime).getTime()
  }));

  // Generate all possible slots
  for (let time = dayStart.getTime(); time < dayEnd.getTime(); time += slotDurationMinutes * 60000) {
    const slotStart = time;
    const slotEnd = time + slotDurationMinutes * 60000;

    // Check if slot overlaps with booking
    const isOccupied = bookedRanges.some(booked => {
      return slotStart < booked.end && slotEnd > booked.start;
    });

    if (!isOccupied) {
      slots.push({
        start: new Date(slotStart),
        end: new Date(slotEnd),
        durationMinutes: slotDurationMinutes
      });
    }
  }

  return slots;
};

export function isDateInPast(date: Date): boolean {
  const now = new Date();
  // Compare only date part for day-based comparisons
  if (date.getDate() === now.getDate() && 
      date.getMonth() === now.getMonth() && 
      date.getFullYear() === now.getFullYear()) {
    // If same day, compare time
    return date.getTime() < now.getTime();
  }
  return date < now;
}

export function isTimeSlotValid(startTime: Date, endTime: Date): boolean {
  return startTime < endTime;
}

export function formatDate(date: Date): string {
  return date.toISOString();
}

export function parseDate(dateString: string): Date {
  return new Date(dateString);
}

export const isOverlapping = (
  existingStart: Date,
  existingEnd: Date,
  newStart: Date,
  newEnd: Date
): boolean => {
  return newStart < existingEnd && newEnd > existingStart;
};

export const isValidBookingDuration = (
  startTime: Date, 
  endTime: Date, 
  maxHours: number = 120,// 5 days
  minMinutes: number = 30
): boolean => {
  const durationInMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
  const maxMinutes = maxHours * 60;
  return durationInMinutes <= maxMinutes && durationInMinutes >= minMinutes;
};

export const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTimeFromDate = (date: Date): string => {
  return date.toTimeString().split(' ')[0];
};

export const isWithinBusinessHours = (
  date: Date,
  openingHour: number = 9,
  closingHour: number = 18
): boolean => {
  const hour = date.getHours();
  const minutes = date.getMinutes();
  
  // Check if time is at exact hour boundaries
  if (hour < openingHour || hour >= closingHour) {
    return false;
  }
  
  // If it's the closing hour, minutes must be 0
  if (hour === closingHour - 1 && minutes > 0) {
    return false;
  }
  
  return true;
};

export const areDatesOnSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};