import { useEffect, useRef, useState } from "react";

import { cn, debounce } from "@/app/_lib/utils";
import { Input } from "@/components/ui/input";

export function ValidatedInput<T>({
  validationFunction,
  onValidInput,
  resetFunction,
  className,
  inputClassName,
  error,
  defaultValue,
  ...props
}: {
  error?: React.ReactNode;
  defaultValue?: string;
  inputClassName?: string;
  validationFunction: (value: string) => Promise<T | undefined>;
  onValidInput: (input: T) => any;
  resetFunction?: () => any;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const [isValidInput, setIsValidInput] = useState<boolean | undefined>(
    undefined,
  );
  // Mandatory to avoid endless rerenders
  const defaultValueRef = useRef<string>();

  // Runs the validation on mount to check values mounted
  // from localStorage
  useEffect(() => {
    // Mandatory to avoid endless rerenders
    if (defaultValueRef.current !== undefined) return;
    defaultValueRef.current = defaultValue;

    if (defaultValue === undefined) return;

    validationFunction(defaultValue).then((validationFunctionRes) => {
      const isValidInput = validationFunctionRes !== undefined;
      setIsValidInput(isValidInput);
      if (validationFunctionRes !== undefined)
        onValidInput(validationFunctionRes);
    });
  }, [defaultValue, onValidInput, validationFunction]);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    props.onChange?.(e);
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
    <div className={cn("flex w-full flex-col gap-0.5", className)}>
      <Input
        {...props}
        defaultValue={defaultValue}
        className={cn(
          inputClassName,
          error !== undefined && isValidInput === false && "border-red-800",
        )}
        onChange={debounce(handleChange, 300)}
      />
      {error !== undefined && isValidInput === false ? (
        <span className="text-xs text-red-800">{error}</span>
      ) : null}
    </div>
  );
}
