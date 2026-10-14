"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { technicianRoutes } from "@/features/auth/redirects";
import { sriLankaDistricts } from "@/features/bookings/schemas";
import { AvatarUploader } from "@/features/users/components/avatar-uploader";

import {
  technicianApplicationSchema,
  type TechnicianApplicationFormValues,
  type TechnicianApplicationInput,
} from "../schemas";
import { submitTechnicianApplicationAction } from "../server/actions";
import { DocumentUploader } from "./document-uploader";

type Props = {
  /** Active categories from the Firestore catalogue. */
  categories: { id: string; name: string }[];
  uid: string;
  email: string;
  photoURL: string | null;
  defaultValues: TechnicianApplicationFormValues;
  submittedDocumentPaths: string[];
  isResubmission: boolean;
};

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function TechnicianApplicationForm({
  categories,
  uid,
  email,
  photoURL,
  defaultValues,
  submittedDocumentPaths,
  isResubmission,
}: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [hasPhoto, setHasPhoto] = useState(Boolean(photoURL));
  const [photoError, setPhotoError] = useState<string | null>(null);
  const form = useForm<TechnicianApplicationFormValues, unknown, TechnicianApplicationInput>({
    resolver: zodResolver(technicianApplicationSchema),
    defaultValues,
    mode: "onTouched",
  });
  const fullName = useWatch({ control: form.control, name: "fullName" });

  async function onSubmit(values: TechnicianApplicationInput) {
    setFormError(null);
    if (!hasPhoto) {
      setPhotoError("Add a clear profile photo so customers can recognise you.");
      return;
    }
    const result = await submitTechnicianApplicationAction({
      ...values,
      skills: values.skills.join(", "),
    });
    if (!result.ok) {
      setFormError(result.error);
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        if (name === "photo") setPhotoError(message);
        else form.setError(name as keyof TechnicianApplicationFormValues, { message });
      }
      return;
    }
    // The action revalidates /technician, so the status page renders fresh.
    router.replace(technicianRoutes.application);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-10">
      <FieldSet>
        <FieldLegend>Your details</FieldLegend>
        <FieldGroup className="gap-5">
          <Field data-invalid={Boolean(photoError)}>
            <FieldLabel>Profile photo</FieldLabel>
            <AvatarUploader
              uid={uid}
              name={fullName || "?"}
              photoURL={photoURL}
              onUploaded={() => {
                setHasPhoto(true);
                setPhotoError(null);
              }}
            />
            {photoError ? <FieldError>{photoError}</FieldError> : null}
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="fullName"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="fullName">Full name</FieldLabel>
                  <Input {...field} id="fullName" autoComplete="name" aria-invalid={fieldState.invalid} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="phoneNumber"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="phoneNumber">Mobile number</FieldLabel>
                  <Input {...field} id="phoneNumber" type="tel" autoComplete="tel" aria-invalid={fieldState.invalid} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <Input id="email" value={email} readOnly disabled />
              <FieldDescription>Your verified account email. Change it from your account settings.</FieldDescription>
            </Field>
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Experience</FieldLegend>
        <FieldGroup className="gap-5">
          <Controller
            control={form.control}
            name="professionalIntroduction"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="intro">Professional introduction</FieldLabel>
                <Textarea
                  {...field}
                  id="intro"
                  rows={5}
                  aria-invalid={fieldState.invalid}
                  aria-describedby="intro-hint"
                />
                <FieldDescription id="intro-hint">
                  Describe the work you do and the kinds of jobs you&apos;re best at (50–1000 characters).
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="yearsOfExperience"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="sm:max-w-48">
                <FieldLabel htmlFor="years">Years of experience</FieldLabel>
                <Input
                  {...field}
                  value={String(field.value ?? "")}
                  id="years"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={60}
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="serviceCategoryIds"
            render={({ field, fieldState }) => (
              <FieldSet data-invalid={fieldState.invalid}>
                <FieldLegend variant="label">Services you offer</FieldLegend>
                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  {categories.map((category) => (
                    <Field key={category.id} orientation="horizontal">
                      <Checkbox
                        id={`category-${category.id}`}
                        checked={field.value.includes(category.id)}
                        onCheckedChange={() => field.onChange(toggle(field.value, category.id))}
                      />
                      <FieldLabel htmlFor={`category-${category.id}`} className="font-normal">
                        {category.name}
                      </FieldLabel>
                    </Field>
                  ))}
                </div>
                <FieldError errors={[fieldState.error]} />
              </FieldSet>
            )}
          />
          <Controller
            control={form.control}
            name="skills"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="skills">Skills</FieldLabel>
                <Input
                  {...field}
                  value={typeof field.value === "string" ? field.value : ""}
                  id="skills"
                  placeholder="e.g. PPR pipe fitting, inverter AC servicing, DB board wiring"
                  aria-invalid={fieldState.invalid}
                  aria-describedby="skills-hint"
                />
                <FieldDescription id="skills-hint">Separate skills with commas.</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="qualifications"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="qualifications">
                  Qualifications <span className="font-normal text-muted-foreground">(optional)</span>
                </FieldLabel>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  id="qualifications"
                  rows={3}
                  placeholder="NVQ level, VTA courses, apprenticeships, licences"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Where you work</FieldLegend>
        <FieldGroup className="gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="district"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="district">Home district</FieldLabel>
                  <NativeSelect {...field} id="district" aria-invalid={fieldState.invalid}>
                    <option value="" disabled>
                      Select a district
                    </option>
                    {sriLankaDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="city"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="city">City or town</FieldLabel>
                  <Input {...field} id="city" autoComplete="address-level2" aria-invalid={fieldState.invalid} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </div>
          <Controller
            control={form.control}
            name="serviceAreas"
            render={({ field, fieldState }) => (
              <FieldSet data-invalid={fieldState.invalid}>
                <FieldLegend variant="label">Districts you can travel to</FieldLegend>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                  {sriLankaDistricts.map((d) => (
                    <Field key={d} orientation="horizontal">
                      <Checkbox
                        id={`area-${d}`}
                        checked={field.value.includes(d)}
                        onCheckedChange={() => field.onChange(toggle(field.value, d))}
                      />
                      <FieldLabel htmlFor={`area-${d}`} className="font-normal">
                        {d}
                      </FieldLabel>
                    </Field>
                  ))}
                </div>
                <FieldError errors={[fieldState.error]} />
              </FieldSet>
            )}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Supporting documents</FieldLegend>
        <Controller
          control={form.control}
          name="qualificationDocumentPaths"
          render={({ field }) => (
            <DocumentUploader
              uid={uid}
              value={field.value}
              onChange={field.onChange}
              submittedPaths={submittedDocumentPaths}
            />
          )}
        />
      </FieldSet>

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Our team reviews every application. You&apos;ll keep your customer account while we review.
        </p>
        <SubmitButton pending={form.formState.isSubmitting} pendingLabel="Submitting…" className="w-full sm:w-auto">
          {isResubmission ? "Resubmit application" : "Submit application"}
        </SubmitButton>
      </div>
    </form>
  );
}
