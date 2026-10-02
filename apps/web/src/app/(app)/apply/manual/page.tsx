"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  manualApplyFormSchema,
  manualOutreachFormSchema,
  type ManualApplyFormValues,
  type ManualOutreachFormValues,
} from "@/lib/validation/manual-apply";
import { useSubmitManualApplyMutation, useSubmitManualOutreachMutation } from "@/lib/queries/manual-apply";

function PasteJobForm() {
  const submit = useSubmitManualApplyMutation();
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ManualApplyFormValues>({
    resolver: zodResolver(manualApplyFormSchema),
    defaultValues: { postings: [{ rawText: "", applicationEmail: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "postings" });

  function onSubmit(values: ManualApplyFormValues) {
    submit.mutate(values.postings, {
      onSuccess: (data) => {
        toast.success(`Queued ${data.enqueued} listing(s) — check Agent activity for progress.`);
        reset({ postings: [{ rawText: "", applicationEmail: "" }] });
      },
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {fields.map((field, i) => (
        <div key={field.id} className="flex flex-col gap-3 rounded-lg border border-border/60 p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor={`postings.${i}.rawText`}>Job listing #{i + 1}</Label>
            {fields.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Textarea
            id={`postings.${i}.rawText`}
            rows={6}
            placeholder="Paste the full job listing text here..."
            aria-invalid={!!errors.postings?.[i]?.rawText}
            {...register(`postings.${i}.rawText`)}
          />
          {errors.postings?.[i]?.rawText && (
            <p role="alert" className="text-sm text-destructive">
              {errors.postings[i]?.rawText?.message}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`postings.${i}.applicationEmail`}>Application email (optional)</Label>
            <Input
              id={`postings.${i}.applicationEmail`}
              placeholder="If the listing doesn't already say — leave blank if unsure or it's a portal apply"
              aria-invalid={!!errors.postings?.[i]?.applicationEmail}
              {...register(`postings.${i}.applicationEmail`)}
            />
            {errors.postings?.[i]?.applicationEmail && (
              <p role="alert" className="text-sm text-destructive">
                {errors.postings[i]?.applicationEmail?.message}
              </p>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ rawText: "", applicationEmail: "" })}
        >
          <Plus className="h-4 w-4" />
          Add another
        </Button>
      </div>

      <Button type="submit" disabled={isSubmitting || submit.isPending} className="self-start">
        {(isSubmitting || submit.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
        Tailor &amp; apply ({fields.length})
      </Button>
    </form>
  );
}

const EMPTY_TARGET = { companyName: "", findEmailForMe: false, contactEmail: "", website: "", context: "" };

function ColdEmailForm() {
  const submit = useSubmitManualOutreachMutation();
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ManualOutreachFormValues>({
    resolver: zodResolver(manualOutreachFormSchema),
    defaultValues: { targets: [EMPTY_TARGET] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "targets" });
  const targets = watch("targets");

  function onSubmit(values: ManualOutreachFormValues) {
    const targets = values.targets.map((t) => ({
      companyName: t.companyName,
      contactEmail: t.findEmailForMe ? undefined : t.contactEmail,
      website: t.findEmailForMe ? t.website || undefined : undefined,
      context: t.context,
    }));
    submit.mutate(targets, {
      onSuccess: (data) => {
        toast.success(`Queued ${data.enqueued} outreach email(s) — check Agent activity for progress.`);
        reset({ targets: [EMPTY_TARGET] });
      },
      onError: (err) => toast.error(err.message),
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {fields.map((field, i) => (
        <div key={field.id} className="flex flex-col gap-3 rounded-lg border border-border/60 p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor={`targets.${i}.companyName`}>Target #{i + 1}</Label>
            {fields.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`targets.${i}.companyName`}>Company</Label>
            <Input
              id={`targets.${i}.companyName`}
              placeholder="Acme Inc."
              aria-invalid={!!errors.targets?.[i]?.companyName}
              {...register(`targets.${i}.companyName`)}
            />
            {errors.targets?.[i]?.companyName && (
              <p role="alert" className="text-sm text-destructive">
                {errors.targets[i]?.companyName?.message}
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded border-input" {...register(`targets.${i}.findEmailForMe`)} />
            I don&apos;t have their email — find one for me
          </label>
          {targets?.[i]?.findEmailForMe ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`targets.${i}.website`}>Company website (optional, improves accuracy)</Label>
              <Input
                id={`targets.${i}.website`}
                placeholder="https://acme.com"
                aria-invalid={!!errors.targets?.[i]?.website}
                {...register(`targets.${i}.website`)}
              />
              {errors.targets?.[i]?.website && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.targets[i]?.website?.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                job-auto will guess a plausible contact email — shown as "guessed, not verified" once ready,
                not a confirmed address.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`targets.${i}.contactEmail`}>Contact email</Label>
              <Input
                id={`targets.${i}.contactEmail`}
                placeholder="hiring@acme.com"
                aria-invalid={!!errors.targets?.[i]?.contactEmail}
                {...register(`targets.${i}.contactEmail`)}
              />
              {errors.targets?.[i]?.contactEmail && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.targets[i]?.contactEmail?.message}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`targets.${i}.context`}>Context</Label>
            <Textarea
              id={`targets.${i}.context`}
              rows={3}
              placeholder="Who they are, why you're reaching out, what role you're interested in..."
              aria-invalid={!!errors.targets?.[i]?.context}
              {...register(`targets.${i}.context`)}
            />
            {errors.targets?.[i]?.context && (
              <p role="alert" className="text-sm text-destructive">
                {errors.targets[i]?.context?.message}
              </p>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(EMPTY_TARGET)}
        >
          <Plus className="h-4 w-4" />
          Add another
        </Button>
      </div>

      <Button type="submit" disabled={isSubmitting || submit.isPending} className="self-start">
        {(isSubmitting || submit.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
        Send cold email(s) ({fields.length})
      </Button>
    </form>
  );
}

export default function ManualApplyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Paste &amp; apply</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Found a job yourself, or want to reach out cold? Paste it here — job-auto tailors your CV (and
          cover letter) and, if there&apos;s a real application email and sending is enabled, applies for
          real via your connected Gmail. Portal-only listings are tailored and left ready for you to submit
          yourself.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-heading text-base">Submit</CardTitle>
          <CardDescription>Add as many as you like — each is tailored and processed independently.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="job">
            <TabsList>
              <TabsTrigger value="job">Job listing</TabsTrigger>
              <TabsTrigger value="cold">Cold email</TabsTrigger>
            </TabsList>
            <TabsContent value="job" className="pt-4">
              <PasteJobForm />
            </TabsContent>
            <TabsContent value="cold" className="pt-4">
              <ColdEmailForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
