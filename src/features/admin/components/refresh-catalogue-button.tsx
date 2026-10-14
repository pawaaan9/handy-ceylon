"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { FormAlert } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { refreshCatalogueAction } from "@/features/catalogue/server/actions";

export function RefreshCatalogueButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await refreshCatalogueAction();
            setMessage(
              result.ok
                ? { tone: "success", text: "Catalogue refreshed. Pages now show the latest Firestore data." }
                : { tone: "error", text: result.error },
            );
            router.refresh();
          })
        }
      >
        {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <RefreshCw data-icon="inline-start" aria-hidden="true" />}
        Refresh catalogue
      </Button>
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
    </div>
  );
}
