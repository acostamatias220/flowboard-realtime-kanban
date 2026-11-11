import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Invalid email').max(255);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  email,
  password: z
    .string()
    .min(8, 'Password must have at least 8 characters')
    .max(72, 'Password must have at most 72 characters') // bcrypt limit
    .regex(/[A-Za-z]/, 'Password must contain a letter')
    .regex(/\d/, 'Password must contain a number'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(72),
});
