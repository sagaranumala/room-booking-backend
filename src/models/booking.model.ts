import mongoose, { Schema, Document } from 'mongoose';
import { Booking } from '../types';


const bookingSchema = new Schema<Booking>({
  roomId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Room', 
    required: true 
  },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  startTime: { 
    type: Date, 
    required: true 
  },
  endTime: { 
    type: Date, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['active', 'cancelled', 'pending', 'confirmed'], 
    default: 'pending' 
  }
}, { 
  timestamps: true 
});

// Index for efficient queries
bookingSchema.index({ roomId: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<Booking>('BookingModel', bookingSchema);