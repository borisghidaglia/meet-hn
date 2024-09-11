"use client";

import { useState } from "react";

import { cn } from "@/app/_lib/utils";

export function CopyToClipboardBtn({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  if (isCopied) {
    setTimeout(() => setIsCopied(false), 1000);
  }

  return (
    <div className={cn("relative", className)}>
      <svg
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setIsCopied(true);
        }}
        className="box-content h-4 w-4 cursor-pointer"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
      >
        <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z" />
      </svg>
      <span
        className={cn(
          "absolute right-full top-0 mr-2 rounded-sm bg-gray-700 px-2 py-1 text-xs text-white opacity-0 transition-opacity",
          isCopied ? "opacity-100" : "",
        )}
      >
        Copied!
      </span>
    </div>
  );
}
