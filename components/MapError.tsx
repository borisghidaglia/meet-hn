"use client";

import { ExternalLink } from "@/components/ui/ExternalLink";
import MapContainerClient from "./MapContainerClient";

export default function MapError() {
  return (
    <div className="grid grid-cols-1 grid-rows-1 place-items-center">
      <MapContainerClient
        cities={[]}
        className="col-start-1 row-start-1 h-[400px] w-full md:h-full"
      />
      <div className="z-[999] col-start-1 row-start-1 mx-5 flex max-w-sm flex-col gap-2 rounded-md bg-black/70 px-4 py-2 text-white shadow-2xl lg:mx-0">
        <p>Cities cannot be fetched right now.</p>
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
    </div>
  );
}
