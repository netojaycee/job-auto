import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" description="Log in to keep your applications running.">
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
