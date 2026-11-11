import { z } from 'zod';
import { uuid } from '../schemas.js';

export const createCardSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
});

export const updateCardSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).nullable(),
    assigneeId: uuid.nullable(),
    dueDate: z.iso.date('Due date must be YYYY-MM-DD').nullable(),
    labelIds: z.array(uuid).max(20),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const moveCardSchema = z.object({
  columnId: uuid,
  index: z.number().int().min(0),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
