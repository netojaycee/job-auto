"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferencesQuery, useSavePreferencesMutation, useSuggestPreferencesMutation } from "@/lib/queries/preferences";
import { preferencesSchema, type PreferencesFormValues } from "@/lib/validation/preferences";

const REMOTE_OPTIONS = [
  { value: "any", label: "Any" },
  { value: "remote", label: "Remote only" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
];

export default function PreferencesPage() {
  const { data: preferences, isLoading } = usePreferencesQuery();
  const saveMutation = useSavePreferencesMutation();
  const suggestMutation = useSuggestPreferencesMutation();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    values: {
      rolesText: (preferences?.roles ?? []).join("\n"),
      locationsText: (preferences?.locations ?? []).join("\n"),
      remotePref: (preferences?.remotePref as PreferencesFormValues["remotePref"]) ?? "any",
      salaryFloor: preferences?.salaryFloor?.toString() ?? "",
      industriesText: (preferences?.industries ?? []).join("\n"),
      maxApplicationsPerDay: (preferences?.maxApplicationsPerDay ?? 10).toString(),
      dailyRunTime: preferences?.dailyRunTime ?? "08:00",
    },
  });

  function handleSuggest() {
    suggestMutation.mutate(undefined, {
      onSuccess: (s) => {
        setValue("rolesText", s.roles.join("\n"));
        setValue("locationsText", s.locations.join("\n"));
        setValue("remotePref", s.remotePref as PreferencesFormValues["remotePref"]);
        setValue("salaryFloor", s.salaryFloor?.toString() ?? "");
        setValue("industriesText", s.industries.join("\n"));
        toast.success("Suggestions applied — review and save.");
      },
      onError: (err) => toast.error(err.message),
    });
  }

  function onSubmit(values: PreferencesFormValues) {
    saveMutation.mutate(
      {
        roles: values.rolesText.split("\n").map((s) => s.trim()).filter(Boolean),
        locations: values.locationsText.split("\n").map((s) => s.trim()).filter(Boolean),
        remotePref: values.remotePref,
        salaryFloor: values.salaryFloor ? Number(values.salaryFloor) : null,
        industries: values.industriesText.split("\n").map((s) => s.trim()).filter(Boolean),
        maxApplicationsPerDay: Number(values.maxApplicationsPerDay),
        dailyRunTime: values.dailyRunTime,
      },
      {
        onSuccess: () => toast.success("Preferences saved."),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Job preferences</h1>
          <p className="mt-1 text-sm text-muted-foreground">What job-auto searches and applies for.</p>
        </div>
        <Button type="button" variant="outline" onClick={handleSuggest} disabled={suggestMutation.isPending}>
          {suggestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Suggest from my CV
        </Button>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="font-heading text-base">Search criteria</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rolesText">Target roles</Label>
                <Textarea id="rolesText" rows={3} placeholder="Software Engineer&#10;Backend Engineer" {...register("rolesText")} />
                <p className="text-xs text-muted-foreground">One per line.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="locationsText">Locations</Label>
                <Textarea id="locationsText" rows={2} placeholder="Remote&#10;Lagos, Nigeria" {...register("locationsText")} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Remote preference</Label>
                  <Controller
                    control={control}
                    name="remotePref"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REMOTE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="salaryFloor">Minimum salary (USD)</Label>
                  <Input id="salaryFloor" type="number" placeholder="Optional" {...register("salaryFloor")} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="industriesText">Industries</Label>
                <Textarea id="industriesText" rows={2} placeholder="Fintech&#10;Healthcare" {...register("industriesText")} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="maxApplicationsPerDay">Max applications per day</Label>
                  <Input
                    id="maxApplicationsPerDay"
                    type="number"
                    min={1}
                    max={50}
                    aria-invalid={!!errors.maxApplicationsPerDay}
                    {...register("maxApplicationsPerDay")}
                  />
                  {errors.maxApplicationsPerDay && (
                    <p role="alert" className="text-sm text-destructive">
                      {errors.maxApplicationsPerDay.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="dailyRunTime">Daily run time (UTC)</Label>
                  <Input id="dailyRunTime" type="time" {...register("dailyRunTime")} />
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting || saveMutation.isPending} className="self-start">
                {(isSubmitting || saveMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
                Save preferences
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
