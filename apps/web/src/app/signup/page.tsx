import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/auth-form";

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" description="Build your profile once, apply every day.">
      <Suspense>
        <SignUpForm />
      </Suspense>
    </AuthShell>
  );
}
