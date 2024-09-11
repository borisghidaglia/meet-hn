import { cn } from "@/app/_lib/utils";
import { GeistSans } from "geist/font/sans";

export function TwitterBanner() {
  return (
    <div className="grid h-[500px] w-[1500px] place-items-center border">
      <h1 className="flex items-baseline gap-2 text-9xl font-bold">meet.hn</h1>
    </div>
  );
}

export function TwitterProfilePicture() {
  return (
    <div
      className={cn(
        "grid h-[400px] w-[400px] place-items-center border bg-[#ff6602] text-white",
        GeistSans.className,
      )}
    >
      <h1 className="flex items-baseline gap-2 text-[15rem] font-semibold leading-none">
        M
      </h1>
    </div>
  );
}
