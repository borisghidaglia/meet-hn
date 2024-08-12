"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { deleteUser } from "@/app/_actions/deleteUser";
import { SubmitButton } from "@/components/SubmitButton";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function DeletePage() {
  const [username, setUsername] = useState<string>("");
  const [isFormDisabled, setIsFormDisabled] = useState<boolean>();
  const [formState, formAction] = useFormState(deleteUser, undefined);

  useEffect(() => {
    if (!formState?.wait) return;

    setIsFormDisabled(true);
    const timer = setTimeout(() => setIsFormDisabled(false), 1000 * 60);

    return () => clearTimeout(timer);
  }, [formState]);

  return (
    <div className="flex max-w-xl flex-col gap-2">
      <p>
        To delete your account, remove all the meet.hn informations from your HN
        description and click on the button below.
      </p>
      <form action={formAction} className="flex flex-col gap-2">
        <Input
          name="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="HN username"
          className="border-[#99999a]"
        />
        <div className="flex items-center justify-between gap-3">
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
          <SubmitButton
            disabled={isFormDisabled || !username}
            className="ml-auto self-start bg-[#ff6602] hover:bg-[#e15b02]"
          >
            Remove me from the map
          </SubmitButton>
        </div>
        <p>
          Open your HN account here:
          <br />
          <ExternalLink
            href={`https://news.ycombinator.com/user?id=${username.length === 0 ? "dang" : username}`}
            className="font-medium"
          >
            {username.length === 0 ? "dang" : username}
          </ExternalLink>
          {username.length === 0 ? (
            <span className="inline italic">
              {" "}
              ⬅️ Placeholder username. Yours will be set here as soon as you
              fill it above.
            </span>
          ) : null}
        </p>
      </form>
    </div>
  );
}
