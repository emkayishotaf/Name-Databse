import { z } from 'zod';

export interface VisitorProfile {
  name: string;
  dob?: string;
  role: string;
  website_url?: string;
}

export interface CustomerEntry {
  id: number | string;
  Name: string;
  dob?: string | null;
  role?: string;
  created_at: string;
}

export const VisitorProfileSchema = z.object({
  name: z.string({ required_error: "Name is required." })
    .trim()
    .min(2, "Name must be at least 2 characters long.")
    .max(30, "Name cannot exceed 30 characters.")
    .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes."),
  dob: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    const d = new Date(val);
    if (isNaN(d.getTime())) return false;
    const now = new Date();
    const minYear = new Date('1900-01-01');
    return d <= now && d >= minYear;
  }, "Date of birth must be a valid date between 1900 and today."),
  role: z.string().default("Developer")
});
