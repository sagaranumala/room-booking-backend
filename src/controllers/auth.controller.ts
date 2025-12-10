import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export const register = async (req: Request, res: Response) => {
    const { name, email, password } = req.body;

    try {
        const user = await authService.registerUser({
            name,
            email,
            passwordHash: password,
        });

        res.status(201).json(user);

    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const { token, user } = await authService.loginUser(email, password);

        res.json({ token, user });

    } catch (error: any) {
        res.status(401).json({ message: error.message });
    }
};
