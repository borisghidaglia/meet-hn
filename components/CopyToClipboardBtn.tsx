"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";

const displayedDuration = 2000;
export function CopyToClipboardBtn({
  text,
  confirmationText,
  children,
  className = "",
}: {
  text: string;
  confirmationText?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    setIsOpen(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, displayedDuration);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <TooltipProvider>
      <Tooltip open={isOpen}>
        <TooltipTrigger asChild className={className}>
          {children !== undefined ? (
            <span
              className="cursor-pointer"
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                showTooltip();
              }}
            >
              {children}
            </span>
          ) : (
            <svg
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                showTooltip();
              }}
              className="box-content h-4 w-4 cursor-pointer"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
            >
              <title>{text}</title>
              <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z" />
            </svg>
          )}
        </TooltipTrigger>
        <TooltipContent
          side="left"
          align="center"
          className="rounded-sm bg-gray-700 px-2 py-1 text-xs text-white"
        >
          {confirmationText !== undefined ? confirmationText : "Copied!"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
