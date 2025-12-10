"use strict";
// export const calculateAvailableSlots = (bookings: any[]) => {
//     const openingTime = 9;   // 9 AM
//     const closingTime = 18;  // 6 PM
//     const slotDuration = 30; // 30 minutes
//     const slots: any[] = [];
//     // Convert bookings to easier structure
//     const bookedRanges = bookings.map(b => ({
//         start: new Date(b.startTime).getTime(),
//         end: new Date(b.endTime).getTime()
//     }));
//     // Generate all possible slots
//     const dayStart = new Date().setHours(openingTime, 0, 0, 0);
//     const dayEnd = new Date().setHours(closingTime, 0, 0, 0);
//     for (let time = dayStart; time < dayEnd; time += slotDuration * 60000) {
//         const slotStart = time;
//         const slotEnd = time + slotDuration * 60000;
//         const isOccupied = bookedRanges.some(b => {
//             return slotStart < b.end && slotEnd > b.start;
//         });
//         if (!isOccupied) {
//             slots.push({
//                 start: new Date(slotStart),
//                 end: new Date(slotEnd),
//             });
//         }
//     }
//     return slots;
// };
