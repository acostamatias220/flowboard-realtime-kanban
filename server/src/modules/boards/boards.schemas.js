import { z } from 'zod';
import { hexColor } from '../schemas.js';

export const createBoardSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  color: hexColor.optional(),
  withDefaultColumns: z.boolean().default(true),
});

export const updateBoardSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable(),
    color: hexColor,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const activityQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: z.coerce.number().int().positive().optional(),
});

export const labelSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: hexColor,
});
