"use client";

import Header from "@/components/Header";
import { ExternalLink } from "@/components/ui/ExternalLink";

export default function Error({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <>
      <Header isRoot />
      <div className="flex flex-col gap-2">
        <p>Oops! Something uncool is breaking this app.</p>
        <p>
          Please make{" "}
          <ExternalLink
            href="https://x.com/borisfyi"
            target="_blank"
            className="font-medium"
          >
            @borisfyi
          </ExternalLink>{" "}
          know on twitter, or by email at{" "}
          <span className="font-medium">hi@meet.hn</span>
        </p>
      </div>
    </>
  );
}
