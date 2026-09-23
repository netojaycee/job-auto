import { z } from "zod";

export const profileDetailsSchema = z.object({
  linkedinUrl: z.union([z.literal(""), z.string().trim().url("Enter a valid URL.")]),
  otherLinksText: z.string(),
  aboutMeText: z.string().max(4000, "Keep it under 4000 characters."),
});
export type ProfileDetailsValues = z.infer<typeof profileDetailsSchema>;
