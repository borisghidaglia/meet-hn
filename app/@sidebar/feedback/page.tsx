"use client";

import { sendFeedback } from "@/app/_actions/sendFeedback";
import { SubmitButton } from "@/components/SubmitButton";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { cn } from "@/lib/utils";
import { useFormState } from "react-dom";

export default function FeedbackPage() {
  const [formState, formAction] = useFormState(sendFeedback, undefined);
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <p>Any feedback is welcome and appreciated.</p>
      <p>
        You can drop me a DM on Twitter{" "}
        <ExternalLink
          href="https://x.com/borisfyi"
          target="_blank"
          className="font-medium"
        >
          @borisfyi
        </ExternalLink>{" "}
        or send a line to <b className="font-medium">feedback@meet.hn</b>
      </p>
      <p>Otherwise, you can also use the form below.</p>
      <form action={formAction} className="flex flex-col gap-2">
        <textarea
          name="feedback"
          className="w-full rounded-sm border bg-slate-500/10 px-3 py-1"
          rows={7}
        ></textarea>
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
    </div>
  );
}
