import request from 'supertest';
import app from '../src/app'; // Adjust the path as necessary
import { User } from '../src/models/user.model';
import { connectDB, disconnectDB } from '../src/config/index'; // Adjust the path as necessary

describe('Authentication Tests', () => {
    let token: string;
    let userId: string;

    beforeAll(async () => {
        await connectDB();
    });

    afterAll(async () => {
        await disconnectDB();
    });

    it('should register a new user', async () => {
        const response = await request(app)
            .post('/auth/register')
            .send({
                name: 'Test User',
                email: 'testuser@example.com',
                password: 'password123'
            });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('user');
        userId = response.body.user.id;
    });

    it('should login the user', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send({
                email: 'testuser@example.com',
                password: 'password123'
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('token');
        token = response.body.token;
        expect(response.body.user).toHaveProperty('id', userId);
    });

    it('should not allow duplicate registration', async () => {
        const response = await request(app)
            .post('/auth/register')
            .send({
                name: 'Test User',
                email: 'testuser@example.com',
                password: 'password123'
            });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message', 'User already exists');
    });

    it('should not login with incorrect password', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send({
                email: 'testuser@example.com',
                password: 'wrongpassword'
            });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should not access protected route without token', async () => {
        const response = await request(app)
            .get('/bookings/me');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('message', 'No token provided');
    });

    it('should access protected route with token', async () => {
        const response = await request(app)
            .get('/bookings/me')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('bookings');
    });
});