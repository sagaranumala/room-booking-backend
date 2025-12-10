// types/index.ts

// User types
export interface User {
  id: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  name?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export type UserRole = 'admin' | 'user' | 'manager' | 'staff';

// JWT Payload (FIXED: Removed duplicate)
export interface JwtPayload {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

// Booking types
export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type BookingStatus = 'active' | 'cancelled' | 'pending' | 'confirmed';

// Room types
export interface Room {
  id: string;
  name: string;
  capacity: number;
  description?: string;
  amenities: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  metadata?: {
    page?: number;
    limit?: number;
    total?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

// Request types
export interface AuthRequest {
  email: string;
  password: string;
}

export interface CreateBookingRequest {
  roomId: string;
  startTime: string;
  endTime: string;
}

export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Add to existing types
export interface AvailableSlotResponse {
  start: string; // ISO string
  end: string;   // ISO string
  durationMinutes: number;
  startTime?: string; // Formatted time "HH:MM"
  endTime?: string;   // Formatted time "HH:MM"
}

export interface RoomAvailability {
  room: {
    id: string;
    name: string;
    capacity: number;
    amenities: string[];
    description?: string;
  };
  date: string; // YYYY-MM-DD
  availableSlots: AvailableSlotResponse[];
  totalAvailableSlots: number;
  isAvailable: boolean;
  totalBookings: number;
  nextAvailableSlot: string | null;
  lastAvailableSlot: string | null;
}

export interface OccupancyReport {
  room: {
    id: string;
    name: string;
    capacity: number;
  };
  dateRange: {
    start: string;
    end: string;
  };
  bookings: Booking[];
  occupancyRate: number;
  totalBookedHours: number;
  totalBusinessHours: number;
}

// Express type augmentation (ADD THIS)
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}