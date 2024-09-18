import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/app/_lib/utils";
import { Input } from "@/components/ui/input";

export function ValidatedInput<T>({
  className,
  inputClassName,
  error,
  value = "",
  validationFunction,
  onValidInput,
  resetFunction,
  ...props
}: {
  error?: React.ReactNode;
  inputClassName?: string;
  value: string;
  validationFunction: (value: string) => Promise<T | undefined>;
  onValidInput: (input: T) => any;
  resetFunction?: () => any;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [isValidInput, setIsValidInput] = useState<boolean | undefined>(
    undefined,
  );

  const debouncedValidation = useMemo(
    () =>
      debounce(async (value: string) => {
        const validationFunctionRes = await validationFunction(value);
        const isValidInput = validationFunctionRes !== undefined;
        setIsValidInput(isValidInput);
        if (isValidInput) {
          onValidInput(validationFunctionRes);
        } else {
          if (!validationFunctionRes) resetFunction?.();
        }
      }, 300),
    [onValidInput, resetFunction, validationFunction],
  );

  // Mandatory to avoid endless rerenders
  const defaultValueRef = useRef<string>();

  // Runs the validation on mount to check values mounted
  // from localStorage
  useEffect(() => {
    // Mandatory to avoid endless rerenders
    if (defaultValueRef.current !== undefined) return;
    defaultValueRef.current = value;

    if (value === undefined) return;
    console.log("Called");

    // debounced not working, it should be called only once on mount
    // it means a new function is probably created everytime
    // also, this ref thing feels hacky
    debouncedValidation(value);
  }, [value, debouncedValidation]);

  return (
    <div className={cn("flex w-full flex-col gap-0.5", className)}>
      <Input
        {...props}
        value={value}
        className={cn(
          inputClassName,
          error !== undefined && isValidInput === false && "border-red-800",
        )}
        onChange={(e) => {
          props.onChange?.(e);
          if (e.target.value === "") {
            setIsValidInput(undefined);
            resetFunction?.();
            return;
          }
          debouncedValidation(e.target.value);
        }}
      />
      {error !== undefined && isValidInput === false ? (
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
      console.log("Actually called");
      callback(...args);
    }, wait);
  };
};
