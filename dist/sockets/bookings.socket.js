"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastBookingRescheduled = exports.broadcastBookingCancelled = exports.broadcastBookingCreated = exports.initSocket = void 0;
const socket_io_1 = require("socket.io");
let io;
const initSocket = (server) => {
    io = new socket_io_1.Server(server);
    io.on("connection", (socket) => {
        console.log("New client connected");
        socket.on("disconnect", () => {
            console.log("Client disconnected");
        });
    });
};
exports.initSocket = initSocket;
const broadcastBookingCreated = (booking) => {
    io.emit("booking-created", {
        bookingId: booking._id,
        roomId: booking.roomId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        userId: booking.userId,
    });
};
exports.broadcastBookingCreated = broadcastBookingCreated;
const broadcastBookingCancelled = (bookingId) => {
    io.emit("booking-cancelled", { bookingId });
};
exports.broadcastBookingCancelled = broadcastBookingCancelled;
const broadcastBookingRescheduled = (booking) => {
    io.emit("booking-rescheduled", {
        bookingId: booking._id,
        roomId: booking.roomId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        userId: booking.userId,
    });
};
exports.broadcastBookingRescheduled = broadcastBookingRescheduled;
