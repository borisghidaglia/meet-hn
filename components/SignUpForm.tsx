"use client";

import { useFormState, useFormStatus } from "react-dom";

import { addUser } from "@/app/_actions/addUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignUpForm({ hash }: { hash: string }) {
  const [state, formAction] = useFormState(addUser.bind(null, hash), {} as any);

  return (
    <form action={formAction} className="max-w-xl flex flex-col gap-2">
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
      <SubmitButton />
      {state && Object.keys(state).length > 0 ? JSON.stringify(state) : null}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="self-end bg-[#ff6602] hover:bg-[#e15b02]"
      disabled={pending}
    >
      <svg
        className={`animate-spin -ml-1 mr-3 h-5 w-5 text-white ${
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
