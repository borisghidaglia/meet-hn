"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { deleteUser } from "@/app/_actions/deleteUser";
import { SubmitButton } from "@/components/SubmitButton";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="flex max-w-xl flex-col gap-4">
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
        <div className="flex items-center justify-end gap-3">
          <Link
            aria-disabled={true}
            className={cn(
              buttonVariants({ variant: "outline" }),
              username.length === 0 && "pointer-events-none opacity-50",
              "border-[#e15b02] bg-transparent text-[#e15b02] hover:bg-transparent hover:text-[#e15b02]",
            )}
            href={`https://news.ycombinator.com/user?id=${username}`}
            target="_blank"
          >
            Open my HN account
          </Link>
          <SubmitButton
            disabled={isFormDisabled || !username}
            className="bg-[#ff6602] hover:bg-[#e15b02]"
          >
            Remove me from the map
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
