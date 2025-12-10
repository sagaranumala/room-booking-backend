import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  name: string;
  capacity: number;
  description?: string;
  amenities: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>({
  name: { 
    type: String, 
    required: true, 
    unique: true 
  },
  capacity: { 
    type: Number, 
    required: true, 
    min: 1 
  },
  description: { 
    type: String 
  },
  amenities: [{ 
    type: String 
  }],
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true 
});

export default mongoose.model<IRoom>('Room', roomSchema);