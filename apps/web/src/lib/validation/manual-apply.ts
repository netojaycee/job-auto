import { z } from "zod";

export const manualPostingSchema = z.object({
  rawText: z.string().min(50, "Paste the full listing — that looks too short."),
  applicationEmail: z.string().email("Enter a valid email, or leave blank.").or(z.literal("")),
});
export type ManualPostingValues = z.infer<typeof manualPostingSchema>;

export const manualApplyFormSchema = z.object({
  postings: z.array(manualPostingSchema).min(1),
});
export type ManualApplyFormValues = z.infer<typeof manualApplyFormSchema>;

export const manualOutreachTargetSchema = z
  .object({
    companyName: z.string().min(1, "Company name is required."),
    findEmailForMe: z.boolean(),
    contactEmail: z.string().email("Enter a valid email.").or(z.literal("")),
    website: z.string().url("Enter a valid URL, or leave blank.").or(z.literal("")),
    context: z.string().min(10, "Give a bit more context — who they are, why you're reaching out."),
  })
  .refine((v) => v.findEmailForMe || v.contactEmail.length > 0, {
    message: "Enter a contact email, or check \"find one for me\".",
    path: ["contactEmail"],
  });
export type ManualOutreachTargetValues = z.infer<typeof manualOutreachTargetSchema>;

export const manualOutreachFormSchema = z.object({
  targets: z.array(manualOutreachTargetSchema).min(1),
});
export type ManualOutreachFormValues = z.infer<typeof manualOutreachFormSchema>;
