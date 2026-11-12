"use client";

import { useActionState } from "react";

import { sendFeedback } from "@/app/_actions/sendFeedback";
import { HONEYPOT_FIELD } from "@/app/_lib/feedback";
import { cn } from "@/app/_lib/utils";
import { SubmitButton } from "@/components/SubmitButton";

export function FeedbackForm() {
  const [formState, formAction] = useActionState(sendFeedback, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="feedback"
        className="w-full rounded-sm border bg-slate-500/10 px-3 py-1"
        rows={7}
      ></textarea>
      {/* Honeypot: off-screen and skipped by keyboard and screen readers, so
          only bots fill it in. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          Leave this empty
          <input
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>
      <div className="flex justify-between gap-2 self-end">
        {formState && Object.keys(formState).length > 0 && (
          <div
            className={cn(
              "text-sm",
              formState.success === true ? "text-green-800" : "text-red-800",
            )}
          >
            {formState.message}
          </div>
        )}
        <SubmitButton className="bg-[#ff6602] hover:bg-[#e15b02]">
          Send
        </SubmitButton>
      </div>
    </form>
  );
}
