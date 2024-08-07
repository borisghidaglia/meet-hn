import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { useState } from "react";

import { useMediaQuery } from "@/app/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function TagSelector({
  selectedTags,
  disabled,
  onTagSelected,
}: {
  selectedTags: string[];
  disabled: boolean;
  onTagSelected: (tag: string) => any;
}) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop)
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            disabled={disabled}
            variant="outline"
            role="combobox"
            className="w-full justify-between border-[#aaaaa4e3] bg-transparent font-normal text-muted-foreground"
          >
            Select Tag...
            <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <TagSelectorList
            selectedTags={selectedTags}
            onSelect={(tag) => {
              onTagSelected(tag);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          disabled={disabled}
          variant="outline"
          role="combobox"
          className="w-full justify-between border-[#aaaaa4e3] bg-transparent font-normal text-muted-foreground"
        >
          Select Social...
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="z-[9999] border-t-0 bg-[#f6f6ef]">
        <DrawerDescription className="hidden">Select socials</DrawerDescription>
        <DrawerTitle className="hidden">Select socials</DrawerTitle>
        <div className="mt-2">
          <TagSelectorList
            className="border-0"
            selectedTags={selectedTags}
            onSelect={(tag) => {
              onTagSelected(tag);
              setOpen(false);
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function TagSelectorList({
  className,
  selectedTags,
  onSelect,
}: {
  className?: string;
  selectedTags: string[];
  onSelect: (tag: string) => any;
}) {
  return (
    <Command
      className={cn("border border-[#aaaaa4e3] bg-[#f6f6ef]", className)}
    >
      <CommandInput placeholder="Search tag..." className="h-9" />
      <CommandList>
        <CommandEmpty>No tag found.</CommandEmpty>
        <CommandGroup>
          {supportedTags.map((tag) => (
            <CommandItem key={tag} value={tag} onSelect={onSelect}>
              {tag}
              <CheckIcon
                className={cn(
                  "ml-auto h-4 w-4",
                  selectedTags.includes(tag) ? "opacity-100" : "opacity-0",
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

const Tag = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => any;
}) => (
  <span
    className="inline-flex items-center rounded bg-[#99999a] px-2.5 py-0.5 text-xs font-medium text-white"
    onClick={onClick}
  >
    {children}
    <button
      type="button"
      className="ms-2 inline-flex items-center rounded-sm bg-transparent p-1 text-sm text-white"
      data-dismiss-target="#badge-dismiss-default"
      aria-label="Remove"
    >
      <svg
        className="h-2 w-2"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 14 14"
      >
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"
        />
      </svg>
    </button>
  </span>
);
TagSelector.Tag = Tag;

export type SupportedTags = (typeof supportedTags)[number];
const supportedTags = [
  "AI/ML",
  "AR/VR",
  "Art",
  "Biotech",
  "Blockchain",
  "Books",
  "Climate Tech",
  "Climbing",
  "Cybersecurity",
  "Cycling",
  "Data Science",
  "DevOps",
  "Digital Nomad",
  // "E-commerce",
  "Education",
  "Entrepreneurship",
  "Fintech",
  "Fitness",
  "Freelancing",
  "Gaming",
  "Hacking",
  "Hardware",
  "Healthcare",
  "Hiking",
  "Investment",
  "IoT",
  "Legal Tech",
  "Marketing",
  "Martial Arts",
  "Media",
  "Mentorship",
  "Mobile Development",
  "Music",
  "Networking",
  "Open Source",
  "Outdoor Activities",
  "Philosophy",
  "Privacy",
  "Programming",
  "Remote Work",
  "Research",
  "Robotics",
  "Running",
  "Science",
  "Social Impact",
  "Space Tech",
  "Sports",
  "Startups",
  "Technology",
  "Travel",
  "UI/UX Design",
  "Web Development",
  "Writing",
  "Yoga",
] as const;
