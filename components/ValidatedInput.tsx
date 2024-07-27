import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function ValidatedInput<T>({
  validationFunction,
  onValidInput,
  resetFunction,
  className,
  error,
  ...props
}: {
  error: React.ReactNode;
  validationFunction: (value: string) => Promise<T | undefined>;
  onValidInput: (input: T) => any;
  resetFunction?: () => any;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [isValidInput, setIsValidInput] = useState<boolean | undefined>(
    undefined,
  );

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === "") {
      setIsValidInput(undefined);
      resetFunction?.();
      return;
    }

    const validationFunctionRes = await validationFunction(e.target.value);
    const isValidInput = validationFunctionRes !== undefined;
    setIsValidInput(isValidInput);
    if (isValidInput) {
      onValidInput(validationFunctionRes);
    } else {
      if (!validationFunctionRes) resetFunction?.();
    }
  };

  return (
    <div className="flex w-full flex-col gap-0.5">
      <Input
        {...props}
        className={cn(className, isValidInput === false && "border-red-800")}
        onChange={debounce(handleChange, 300)}
      />
      {isValidInput === false ? (
        <span className="text-xs text-red-800">{error}</span>
      ) : null}
    </div>
  );
}

const debounce = <T extends (...args: any[]) => void>(
  callback: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      callback(...args);
    }, wait);
  };
};
