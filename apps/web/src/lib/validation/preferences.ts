import { z } from "zod";

export const preferencesSchema = z.object({
  rolesText: z.string(),
  locationsText: z.string(),
  remotePref: z.enum(["any", "remote", "hybrid", "onsite"]),
  salaryFloor: z.string(),
  industriesText: z.string(),
  maxApplicationsPerDay: z
    .string()
    .refine((v) => {
      const n = Number(v);
      return Number.isInteger(n) && n >= 1 && n <= 50;
    }, "Enter a number between 1 and 50."),
  dailyRunTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM."),
});
export type PreferencesFormValues = z.infer<typeof preferencesSchema>;
