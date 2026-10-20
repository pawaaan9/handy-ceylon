"use client";

import { LogOut } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

import { useSignOut } from "./sign-out-button";

/** Asks before ending the session. Controlled, so menus can open it from an item. */
export function LogoutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { signOut, pending } = useSignOut();
  return (
    <AlertDialog open={open} onOpenChange={(value) => !pending && onOpenChange(value)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Log out of Handy Ceylon?</AlertDialogTitle>
          <AlertDialogDescription>You&apos;ll need to log in again to get back to your account.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Stay logged in</AlertDialogCancel>
          <Button variant="destructive" onClick={signOut} disabled={pending} aria-busy={pending}>
            {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <LogOut data-icon="inline-start" aria-hidden="true" />}
            {pending ? "Logging out…" : "Log out"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
