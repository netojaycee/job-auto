import { z } from "zod";

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .email("That doesn't look like an email address.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name.").max(80, "That's a bit long."),
  email,
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(128, "That's a bit long."),
});
export type SignUpValues = z.infer<typeof signUpSchema>;
