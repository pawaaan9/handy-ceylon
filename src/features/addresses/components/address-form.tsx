"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LocateFixed } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { FormAlert } from "@/components/forms/form-alert";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { sriLankaDistricts } from "@/features/bookings/schemas";

import { addressInputSchema, type AddressFormValues, type AddressInput } from "../schemas";
import { createAddressAction, updateAddressAction } from "../server/actions";

type Props = (
  | { mode: "create"; defaultValues: AddressFormValues; isDefault?: never; addressId?: never }
  | { mode: "edit"; addressId: string; defaultValues: AddressFormValues; isDefault: boolean }
) & {
  /** Embedded use (e.g. inside the request form): called instead of navigating away. */
  onSaved?: (addressId: string) => void;
  onCancel?: () => void;
};

const optional = <span className="font-normal text-muted-foreground">(optional)</span>;

export function AddressForm(props: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const form = useForm<AddressFormValues, unknown, AddressInput>({
    resolver: zodResolver(addressInputSchema),
    defaultValues: props.defaultValues,
    mode: "onTouched",
  });

  async function onSubmit() {
    setFormError(null);
    // Send the raw form strings; the server re-validates and normalises.
    const raw = form.getValues();
    const result =
      props.mode === "create"
        ? await createAddressAction(raw)
        : await updateAddressAction(props.addressId, raw);
    if (!result.ok) {
      setFormError(result.error);
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof AddressFormValues, { message });
      }
      return;
    }
    if (props.onSaved) {
      props.onSaved(props.mode === "create" ? (result.data as { id: string }).id : props.addressId);
      return;
    }
    router.replace(`/customer/addresses?status=${props.mode === "create" ? "created" : "updated"}`);
  }

  function fillCurrentLocation() {
    setLocationError(null);
    if (!("geolocation" in navigator)) {
      setLocationError("Location isn't available in this browser. Enter the coordinates manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue("latitude", position.coords.latitude.toFixed(6), { shouldDirty: true, shouldValidate: true });
        form.setValue("longitude", position.coords.longitude.toFixed(6), { shouldDirty: true, shouldValidate: true });
        setLocating(false);
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. You can enter the coordinates manually or skip this."
            : "We couldn't get your location. Try again or skip this.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  const text = (
    name: Exclude<keyof AddressFormValues, "district" | "makeDefault" | "directions">,
    label: React.ReactNode,
    extra: React.ComponentProps<typeof Input> = {},
    className?: string,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            {...field}
            value={(field.value as string | undefined) ?? ""}
            id={name}
            aria-invalid={fieldState.invalid}
            {...extra}
          />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-8">
      <FieldSet>
        <FieldLegend>Contact at this address</FieldLegend>
        <FieldGroup className="gap-5 sm:grid sm:grid-cols-2">
          {text("label", "Address name", { placeholder: "Home, Office, Mum's house", maxLength: 30 }, "sm:col-span-2")}
          {text("recipientName", "Recipient name", { autoComplete: "name" })}
          {text("contactNumber", "Contact number", { type: "tel", autoComplete: "tel", inputMode: "tel", placeholder: "077 123 4567" })}
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Address</FieldLegend>
        <FieldGroup className="gap-5 sm:grid sm:grid-cols-2">
          {text("houseOrBuilding", "House number or building", { autoComplete: "address-line1", placeholder: "No. 12 or Lotus Towers, Apt 4B" })}
          {text("street", "Street or road", { autoComplete: "address-line2", placeholder: "Temple Road" })}
          {text("city", "City or town", { autoComplete: "address-level2" })}
          <Controller
            control={form.control}
            name="district"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="district">District</FieldLabel>
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
          {text("postalCode", <>Postal code {optional}</>, { inputMode: "numeric", autoComplete: "postal-code", maxLength: 5, placeholder: "20000" })}
          <Controller
            control={form.control}
            name="directions"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="sm:col-span-2">
                <FieldLabel htmlFor="directions">Additional directions {optional}</FieldLabel>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  id="directions"
                  rows={3}
                  maxLength={300}
                  placeholder="Landmarks, gate colour, parking or access notes"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Map location {optional}</FieldLegend>
        <FieldDescription>Helps technicians find you. Shared only after you confirm a booking.</FieldDescription>
        <FieldGroup className="gap-5 sm:grid sm:grid-cols-2">
          {text("latitude", "Latitude", { inputMode: "decimal", placeholder: "6.9271" })}
          {text("longitude", "Longitude", { inputMode: "decimal", placeholder: "79.8612" })}
        </FieldGroup>
        <div className="space-y-3">
          <Button type="button" variant="outline" size="lg" onClick={fillCurrentLocation} disabled={locating}>
            {locating ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : (
              <LocateFixed data-icon="inline-start" aria-hidden="true" />
            )}
            {locating ? "Finding your location…" : "Use my current location"}
          </Button>
          {locationError ? <FormAlert tone="info">{locationError}</FormAlert> : null}
        </div>
      </FieldSet>

      {props.mode === "edit" && props.isDefault ? (
        <p className="text-sm text-muted-foreground">This is your default address.</p>
      ) : (
        <Controller
          control={form.control}
          name="makeDefault"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id="makeDefault"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              <FieldLabel htmlFor="makeDefault" className="font-normal">
                Use as my default address
              </FieldLabel>
            </Field>
          )}
        />
      )}

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" size="xl" onClick={() => (props.onCancel ? props.onCancel() : router.push("/customer/addresses"))}>
          Cancel
        </Button>
        <SubmitButton pending={form.formState.isSubmitting} pendingLabel="Saving…">
          {props.mode === "create" ? "Save address" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
