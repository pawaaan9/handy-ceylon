"use client";

import { Pencil, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { deleteAddressAction, setDefaultAddressAction } from "../server/actions";

export function AddressActions({ id, label, isDefault }: { id: string; label: string; isDefault: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"default" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function run(kind: "default" | "delete") {
    setError(null);
    setBusy(kind);
    startTransition(async () => {
      const result = kind === "default" ? await setDefaultAddressAction(id) : await deleteAddressAction(id);
      setBusy(null);
      if (!result.ok) {
        setOpen(false);
        setError(result.error);
        return;
      }
      setOpen(false);
      router.replace(kind === "delete" ? "/customer/addresses?status=deleted" : "/customer/addresses?status=default");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="lg">
          <Link href={`/customer/addresses/${id}/edit`} aria-label={`Edit ${label}`}>
            <Pencil data-icon="inline-start" aria-hidden="true" />
            Edit
          </Link>
        </Button>
        {!isDefault ? (
          <Button variant="ghost" size="lg" disabled={pending} onClick={() => run("default")} aria-label={`Make ${label} the default address`}>
            {busy === "default" ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <Star data-icon="inline-start" aria-hidden="true" />}
            Set as default
          </Button>
        ) : null}
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="lg" className="text-destructive hover:text-destructive" aria-label={`Delete ${label}`}>
              <Trash2 data-icon="inline-start" aria-hidden="true" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{label}”?</AlertDialogTitle>
              <AlertDialogDescription>
                {isDefault
                  ? "This is your default address. Your most recently used address will become the default."
                  : "You can add it again later if you need it."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Keep address</AlertDialogCancel>
              <Button variant="destructive" disabled={pending} onClick={() => run("delete")}>
                {busy === "delete" ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                Delete address
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    </div>
  );
}
