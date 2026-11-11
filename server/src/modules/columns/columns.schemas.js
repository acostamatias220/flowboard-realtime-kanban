import { z } from 'zod';

const title = z.string().trim().min(1).max(80);
const wipLimit = z.number().int().min(1).max(999).nullable();

export const createColumnSchema = z.object({ title, wipLimit: wipLimit.optional() });

export const updateColumnSchema = z
  .object({ title, wipLimit })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
