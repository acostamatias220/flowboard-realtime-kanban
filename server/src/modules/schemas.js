import { z } from 'zod';

export const uuid = z.string().uuid('Invalid id');
export const idParam = z.object({ id: uuid });
export const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #aabbcc');
export const role = z.enum(['admin', 'member']);
