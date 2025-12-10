import { Server } from "socket.io";

let io: Server;

export const initSocket = (server: any) => {
    io = new Server(server);

    io.on("connection", (socket) => {
        console.log("New client connected");

        socket.on("disconnect", () => {
            console.log("Client disconnected");
        });
    });
};

export const broadcastBookingCreated = (booking: any) => {
    io.emit("booking-created", {
        bookingId: booking._id,
        roomId: booking.roomId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        userId: booking.userId,
    });
};

export const broadcastBookingCancelled = (bookingId: string) => {
    io.emit("booking-cancelled", { bookingId });
};

export const broadcastBookingRescheduled = (booking: any) => {
    io.emit("booking-rescheduled", {
        bookingId: booking._id,
        roomId: booking.roomId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        userId: booking.userId,
    });
};