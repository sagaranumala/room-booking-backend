"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const user_model_1 = __importDefault(require("../models/user.model"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = __importDefault(require("../config/index"));
const saltRounds = 10;
class AuthService {
    async registerUser(userData) {
        try {
            const existingUser = await user_model_1.default.findOne({ email: userData.email });
            if (existingUser) {
                throw new Error('User already exists');
            }
            const hashedPassword = await bcrypt_1.default.hash(userData.passwordHash, saltRounds);
            const newUser = new user_model_1.default({
                name: userData.name,
                email: userData.email,
                passwordHash: hashedPassword,
                role: userData.role || 'user'
            });
            await newUser.save();
            return newUser;
        }
        catch (error) {
            throw error;
        }
    }
    async loginUser(email, password) {
        try {
            const user = await user_model_1.default.findOne({ email });
            if (!user || !(await bcrypt_1.default.compare(password, user.passwordHash))) {
                throw new Error('Invalid email or password');
            }
            const token = jsonwebtoken_1.default.sign({ id: user._id, role: user.role }, index_1.default.JWT_SECRET, { expiresIn: '1h' });
            return { token, user };
        }
        catch (error) {
            throw error;
        }
    }
    async findUserByEmail(email) {
        try {
            return await user_model_1.default.findOne({ email });
        }
        catch (error) {
            throw error;
        }
    }
    async findUserById(id) {
        try {
            return await user_model_1.default.findById(id);
        }
        catch (error) {
            throw error;
        }
    }
}
exports.AuthService = AuthService;
