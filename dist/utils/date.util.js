"use strict";
// 
Object.defineProperty(exports, "__esModule", { value: true });
exports.areDatesOnSameDay = exports.isWithinBusinessHours = exports.getTimeFromDate = exports.formatDateToYYYYMMDD = exports.isValidBookingDuration = exports.isOverlapping = exports.calculateAvailableSlots = void 0;
exports.isDateInPast = isDateInPast;
exports.isTimeSlotValid = isTimeSlotValid;
exports.formatDate = formatDate;
exports.parseDate = parseDate;
const calculateAvailableSlots = (bookings, date, openingHour = 9, closingHour = 18, slotDurationMinutes = 30) => {
    const slots = [];
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
exports.calculateAvailableSlots = calculateAvailableSlots;
function isDateInPast(date) {
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
function isTimeSlotValid(startTime, endTime) {
    return startTime < endTime;
}
function formatDate(date) {
    return date.toISOString();
}
function parseDate(dateString) {
    return new Date(dateString);
}
const isOverlapping = (existingStart, existingEnd, newStart, newEnd) => {
    return newStart < existingEnd && newEnd > existingStart;
};
exports.isOverlapping = isOverlapping;
const isValidBookingDuration = (startTime, endTime, maxHours = 120, // 5 days
minMinutes = 30) => {
    const durationInMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
    const maxMinutes = maxHours * 60;
    return durationInMinutes <= maxMinutes && durationInMinutes >= minMinutes;
};
exports.isValidBookingDuration = isValidBookingDuration;
const formatDateToYYYYMMDD = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
exports.formatDateToYYYYMMDD = formatDateToYYYYMMDD;
const getTimeFromDate = (date) => {
    return date.toTimeString().split(' ')[0];
};
exports.getTimeFromDate = getTimeFromDate;
const isWithinBusinessHours = (date, openingHour = 9, closingHour = 18) => {
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
exports.isWithinBusinessHours = isWithinBusinessHours;
const areDatesOnSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
};
exports.areDatesOnSameDay = areDatesOnSameDay;
