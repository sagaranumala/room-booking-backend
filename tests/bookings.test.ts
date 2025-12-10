import request from 'supertest';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/config/index';
import { Booking } from '../src/models/booking.model';
import { Room } from '../src/models/room.model';
import { User } from '../src/models/user.model';

let token: string;
let roomId: string;
let userId: string;

beforeAll(async () => {
    await connectDB();
    
    // Create a test user
    const userResponse = await request(app)
        .post('/auth/register')
        .send({ name: 'Test User', email: 'test@example.com', password: 'password' });
    userId = userResponse.body.user.id;

    // Login to get the token
    const loginResponse = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' });
    token = loginResponse.body.token;

    // Create a test room
    const roomResponse = await request(app)
        .post('/rooms')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Conference Room', capacity: 10 });
    roomId = roomResponse.body._id;
});

afterAll(async () => {
    await Booking.deleteMany({});
    await Room.deleteMany({});
    await User.deleteMany({});
    await disconnectDB();
});

describe('Booking Management', () => {
    it('should create a booking', async () => {
        const response = await request(app)
            .post('/bookings')
            .set('Authorization', `Bearer ${token}`)
            .send({ roomId, startTime: new Date(Date.now() + 3600000).toISOString(), endTime: new Date(Date.now() + 7200000).toISOString() });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('bookingId');
    });

    it('should prevent overlapping bookings', async () => {
        await request(app)
            .post('/bookings')
            .set('Authorization', `Bearer ${token}`)
            .send({ roomId, startTime: new Date(Date.now() + 3600000).toISOString(), endTime: new Date(Date.now() + 7200000).toISOString() });

        const response = await request(app)
            .post('/bookings')
            .set('Authorization', `Bearer ${token}`)
            .send({ roomId, startTime: new Date(Date.now() + 5400000).toISOString(), endTime: new Date(Date.now() + 9000000).toISOString() });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            conflict: true,
            message: "Room is already booked during this time",
            conflictingBookings: expect.any(Array)
        });
    });

    it('should list user bookings', async () => {
        const response = await request(app)
            .get('/bookings/me')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(expect.arrayContaining([expect.objectContaining({ userId })]));
    });
});