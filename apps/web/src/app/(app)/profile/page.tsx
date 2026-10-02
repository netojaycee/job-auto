"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileUp, Loader2, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAnswerClarifyingQuestionsMutation,
  useProfileQuery,
  useSaveProfileMutation,
  useUploadCvMutation,
} from "@/lib/queries/profile";
import { profileDetailsSchema, type ProfileDetailsValues } from "@/lib/validation/profile";

function ClarifyingQuestions() {
  const { data: profile } = useProfileQuery();
  const answerMutation = useAnswerClarifyingQuestionsMutation();
  const [answers, setAnswers] = useState<string[]>(
    () => profile?.clarifyingQa?.map((qa) => qa.answer ?? "") ?? [],
  );

  const questions = profile?.clarifyingQa;
  if (!questions || questions.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="font-heading text-base">A few questions to sharpen your profile</CardTitle>
        <CardDescription>Specific to your CV — the more you answer, the better your matches.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            answerMutation.mutate(answers, {
              onSuccess: () => toast.success("Answers saved — profile updated."),
              onError: (err) => toast.error(err.message),
            });
          }}
          className="flex flex-col gap-4"
        >
          {questions.map((qa, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Label htmlFor={`qa-${i}`} className="font-normal text-foreground">
                {qa.question}
              </Label>
              <Input
                id={`qa-${i}`}
                value={answers[i] ?? qa.answer ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => {
                    const next = [...prev];
                    next[i] = e.target.value;
                    return next;
                  })
                }
              />
            </div>
          ))}
          <Button type="submit" size="sm" className="self-start" disabled={answerMutation.isPending}>
            {answerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save answers
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function GmailConnection({ connectedAt }: { connectedAt: string | null }) {
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="font-heading text-base">Gmail</CardTitle>
        <CardDescription>
          Applications send from your own inbox — real Sent folder, replies come to you.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        {connectedAt && (
          <p className="text-sm text-foreground/90">
            Connected {new Date(connectedAt).toLocaleDateString()}.
          </p>
        )}
        <Button type="button" variant="outline" render={<a href="/api/gmail/connect" />}>
          <Mail className="h-4 w-4" />
          {connectedAt ? "Reconnect Gmail" : "Connect Gmail"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfileQuery();
  const uploadCv = useUploadCvMutation();
  const saveProfile = useSaveProfileMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (searchParams.get("gmail_connected")) {
      toast.success("Gmail connected.");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      router.replace(pathname);
    } else if (searchParams.get("gmail_error")) {
      toast.error(`Gmail connection failed: ${searchParams.get("gmail_error")}`);
      router.replace(pathname);
    }
  }, [searchParams, router, pathname]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileDetailsValues>({
    resolver: zodResolver(profileDetailsSchema),
    values: {
      linkedinUrl: profile?.linkedinUrl ?? "",
      otherLinksText: (profile?.otherLinks ?? []).join("\n"),
      aboutMeText: profile?.aboutMeText ?? "",
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadCv.mutate(file, {
      onSuccess: () => toast.success("CV parsed and profile synthesized."),
      onError: (err) => toast.error(err.message),
    });
    e.target.value = "";
  }

  function onSubmit(values: ProfileDetailsValues) {
    saveProfile.mutate(
      {
        linkedinUrl: values.linkedinUrl || null,
        otherLinks: values.otherLinksText.split("\n").map((l) => l.trim()).filter(Boolean),
        aboutMeText: values.aboutMeText || null,
      },
      {
        onSuccess: () => toast.success("Profile saved."),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is what job-auto uses to find and tailor applications for you.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-heading text-base">CV</CardTitle>
          <CardDescription>PDF or .docx. Re-upload any time to refresh your profile.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadCv.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadCv.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                {uploadCv.isPending ? "Parsing…" : profile?.parsedCvJson ? "Re-upload CV" : "Upload CV"}
              </Button>

              {profile?.parsedCvJson && (
                <div className="mt-4 rounded-lg border border-border/60 bg-secondary/40 p-4 text-sm">
                  <p>{profile.parsedCvJson.summary}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {profile.parsedCvJson.skills.map((skill) => (
                      <Badge key={skill} variant="secondary" className="font-normal">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                  {profile.parsedCvJson.suggestedRoles.length > 0 && (
                    <p className="mt-3 text-muted-foreground">
                      Suggested roles: {profile.parsedCvJson.suggestedRoles.join(", ")}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <GmailConnection connectedAt={profile?.gmailConnectedAt ?? null} />

      <ClarifyingQuestions />

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-heading text-base">About you</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
              <Input
                id="linkedinUrl"
                placeholder="https://linkedin.com/in/..."
                aria-invalid={!!errors.linkedinUrl}
                {...register("linkedinUrl")}
              />
              {errors.linkedinUrl && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.linkedinUrl.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="otherLinksText">Other links</Label>
              <Textarea
                id="otherLinksText"
                rows={3}
                placeholder="https://github.com/...&#10;https://portfolio.com"
                {...register("otherLinksText")}
              />
              <p className="text-xs text-muted-foreground">One per line.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aboutMeText">About me</Label>
              <Textarea
                id="aboutMeText"
                rows={5}
                placeholder="Tell us about yourself, what you're looking for, anything your CV doesn't capture..."
                aria-invalid={!!errors.aboutMeText}
                {...register("aboutMeText")}
              />
              {errors.aboutMeText && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.aboutMeText.message}
                </p>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting || saveProfile.isPending} className="self-start">
              {(isSubmitting || saveProfile.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      {profile?.canonicalProfileText && (
        <Card className="border-brand/30 bg-brand-soft/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-base">
              <Sparkles className="h-4 w-4 text-brand" />
              Synthesized profile
            </CardTitle>
            <CardDescription>What we actually use to score and tailor applications.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm text-foreground/90">{profile.canonicalProfileText}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
