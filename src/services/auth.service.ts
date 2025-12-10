import User from '../models/user.model';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import config from '../config/index';
import { UserRole } from '../types/index';

const saltRounds = 10;

export interface UserData {
  id: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  name?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export class AuthService {

    async registerUser(userData: { name: string; email: string; passwordHash: string; role?: 'user' | 'admin' }) {
        try {
            const existingUser = await User.findOne({ email: userData.email });
            if (existingUser) {
                throw new Error('User already exists');
            }

            const hashedPassword = await bcrypt.hash(userData.passwordHash, saltRounds);
            const newUser = new User({
                name: userData.name,
                email: userData.email,
                passwordHash: hashedPassword,
                role: userData.role || 'user'
            });

            await newUser.save();
            return newUser;
        } catch (error) {
            throw error;
        }
    }

    async loginUser(email: string, password: string): Promise<{ token: string; user: UserData }> {
        try {
            const user = await User.findOne({ email });
            if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
                throw new Error('Invalid email or password');
            }

            const token = jwt.sign(
                { id: user._id, role: user.role },
                config.JWT_SECRET,
                { expiresIn: '1h' }
            );

            return { token, user };
        } catch (error) {
            throw error;
        }
    }

    async findUserByEmail(email: string) {
        try {
            return await User.findOne({ email });
        } catch (error) {
            throw error;
        }
    }

    async findUserById(id: string) {
        try {
            return await User.findById(id);
        } catch (error) {
            throw error;
        }
    }
}
