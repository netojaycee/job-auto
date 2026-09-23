import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-secondary/30 px-6 py-16">
      <Link href="/" className="mb-8 flex items-center gap-2 font-heading text-lg font-bold">
        <LogoMark className="h-7 w-7" color="var(--brand)" />
        job-auto
      </Link>
      <Card className="w-full max-w-sm border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
