# Mini Booking Management System

This project is a mini Booking Management System that allows authenticated users to reserve meeting rooms. It includes features such as user authentication, room availability checks, booking conflict prevention, and admin-only endpoints.

## Features

- **User Authentication**: Users can register and log in using JWT for secure access.
- **Room Management**: Admins can create rooms and check their availability.
- **Booking Management**: Users can book rooms, reschedule bookings, and view their own bookings.
- **Real-time Updates**: The system supports real-time updates for booking events using WebSockets or SSE.

## Project Structure

```
max-room-booking-backend
├── src
│   ├── server.ts
│   ├── app.ts
│   ├── config
│   │   └── index.ts
│   ├── controllers
│   │   ├── auth.controller.ts
│   │   ├── rooms.controller.ts
│   │   └── bookings.controller.ts
│   ├── routes
│   │   ├── auth.routes.ts
│   │   ├── rooms.routes.ts
│   │   └── bookings.routes.ts
│   ├── models
│   │   ├── user.model.ts
│   │   ├── room.model.ts
│   │   └── booking.model.ts
│   ├── services
│   │   ├── auth.service.ts
│   │   ├── room.service.ts
│   │   └── booking.service.ts
│   ├── middlewares
│   │   ├── auth.middleware.ts
│   │   └── role.middleware.ts
│   ├── sockets
│   │   └── bookings.socket.ts
│   ├── utils
│   │   └── date.util.ts
│   └── types
│       └── index.ts
├── tests
│   ├── auth.test.ts
│   └── bookings.test.ts
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Setup Instructions

1. **Clone the Repository**:
   ```
   git clone <repository-url>
   cd max-room-booking-backend
   ```

2. **Install Dependencies**:
   ```
   npm install
   ```

3. **Environment Variables**:
   Create a `.env` file based on the `.env.example` file and fill in the required values.

4. **Run the Application**:
   ```
   npm run start
   ```

5. **Testing**:
   To run tests, use:
   ```
   npm run test
   ```

## API Usage

### Authentication

- **Register**: `POST /auth/register`
- **Login**: `POST /auth/login`

### Room Management (Admin Only)

- **Create Room**: `POST /rooms`
- **Check Availability**: `GET /rooms/availability?date=<date>`

### Booking Management

- **Create Booking**: `POST /bookings`
- **Reschedule Booking**: `PATCH /bookings/:id/reschedule`
- **List User Bookings**: `GET /bookings/me`

### Admin Booking Management

- **List All Bookings**: `GET /admin/bookings`

### Real-time Updates

- **WebSocket/SSE Endpoint**: `/bookings/stream`

## License

This project is licensed under the MIT License.