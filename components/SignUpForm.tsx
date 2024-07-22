"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { addUser } from "@/app/_actions/addUser";
import { Button, ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignUpForm({ uuid }: { uuid: string }) {
  const [state, formAction] = useFormState(addUser.bind(null, uuid), undefined);
  const [isFormDisabled, setIsFormDisabled] = useState<boolean>(false);

  useEffect(() => {
    if (!state?.wait) return;

    setIsFormDisabled(true);
    const timer = setTimeout(() => setIsFormDisabled(false), 1000 * 60);

    return () => clearTimeout(timer);
  }, [state]);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-2">
      <Input
        name="username"
        type="text"
        placeholder="HN username"
        className="border-[#99999a]"
      />
      <Input
        name="location"
        type="text"
        placeholder="City, Country"
        className="border-[#99999a]"
      />
      <SubmitButton disabled={isFormDisabled} />
      {state && Object.keys(state).length > 0 ? JSON.stringify(state) : null}
    </form>
  );
}

function SubmitButton(props: ButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="self-end bg-[#ff6602] hover:bg-[#e15b02]"
      disabled={pending || props.disabled}
      {...props}
    >
      <svg
        className={`-ml-1 mr-3 h-5 w-5 animate-spin text-white ${
          pending ? "" : "hidden"
        }`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      Register
    </Button>
  );
}
