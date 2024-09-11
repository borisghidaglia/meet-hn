"use client";

import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { useState } from "react";

import { useMediaQuery } from "@/app/_hooks/useMediaQuery";
import { cn } from "@/app/_lib/utils";
import { fakeAtHnSocial } from "@/components/SignUpForm";
import { parseSocial, Social } from "@/components/Socials";
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
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ValidatedInput } from "@/components/ValidatedInput";

export function SocialSelector({
  socials,
  selectedSocialsNames,
  disabled,
  onSocialSelected,
}: {
  socials: Social[];
  selectedSocialsNames: string[];
  disabled: boolean;
  onSocialSelected: (social: Social) => any;
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
            Add Socials...
            <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <SocialSelectorList
            className="border-0"
            onSelect={onSocialSelected}
            socials={socials}
            selectedSocialsNames={selectedSocialsNames}
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
          Add Socials...
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="z-[9999] border-t-0 bg-[#f6f6ef]">
        <DrawerDescription className="hidden">Add socials</DrawerDescription>
        <DrawerTitle className="hidden">Add socials</DrawerTitle>
        <div className="mt-2">
          <SocialSelectorList
            className="border-0"
            onSelect={onSocialSelected}
            socials={socials}
            selectedSocialsNames={selectedSocialsNames}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function SocialSelectorList({
  className,
  socials,
  selectedSocialsNames,
  onSelect,
}: {
  className?: string;
  socials: Social[];
  selectedSocialsNames: string[];
  onSelect: (socials: Social) => any;
}) {
  return (
    <Command
      className={cn("border border-[#aaaaa4e3] bg-[#f6f6ef]", className)}
    >
      <CommandInput placeholder="Search socials..." className="h-9" />
      <CommandList>
        <CommandEmpty>No social found.</CommandEmpty>
        <CommandGroup>
          {socials.map((social) => (
            <CommandItem
              key={social.name}
              value={social.name}
              onSelect={() => onSelect(social)}
            >
              <div
                className={cn(
                  "flex gap-2",
                  social.name !== "Cal.com" ? "items-center" : "items-baseline",
                )}
              >
                {social.logo}
                {social.name}
              </div>
              <CheckIcon
                className={cn(
                  "ml-auto h-4 w-4",
                  selectedSocialsNames.includes(social.name)
                    ? "opacity-100"
                    : "opacity-0",
                )}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

SocialSelector.Input = SocialInput;
function SocialInput({
  social,
  defaultValue,
  onChange,
  onDelete,
}: {
  social: Social;
  defaultValue?: string;
  onChange: (social: Social, value: string) => any;
  onDelete: (social: Social) => any;
}) {
  return (
    <div
      key={social.name}
      className="grid grid-cols-[min-content,1fr,min-content] grid-rows-[max-content,max-content] place-items-start gap-x-2 gap-y-0.5"
    >
      <span className="mt-2 cursor-pointer">{social.logo}</span>
      <ValidatedInput
        validationFunction={async (value) => {
          const parsedSocial = parseSocial(
            "https://" + social.rootUrl + value,
            social.pattern,
            social.allowedDomain,
          );
          if (!parsedSocial) return;
          return value;
        }}
        resetFunction={() => onChange(social, "")}
        onValidInput={(value) => onChange(social, value)}
        error="Linked could not be parsed. It should match the example below."
        type="text"
        name={social.name}
        className="border-[#99999a]"
        placeholder={social.idReadableName}
        defaultValue={defaultValue}
      />
      <span className="col-start-2 row-start-2 justify-self-start text-xs">
        {social.exampleUrl}
      </span>
      <svg
        onClick={() => onDelete(social)}
        className="mt-2 h-5 cursor-pointer fill-current"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        width="24px"
      >
        <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
      </svg>
    </div>
  );
}

export function AtHnInput({
  username,
  onDelete,
}: {
  username: string;
  onDelete: (social: Social) => any;
}) {
  return (
    <div className="grid grid-cols-[max-content,1fr,min-content] grid-rows-[max-content,max-content] place-items-start gap-x-2 gap-y-0.5">
      <span className="mt-2 cursor-pointer">{fakeAtHnSocial.logo}</span>
      <div className="flex w-full flex-col gap-0.5">
        <Input disabled value={`${username}.at.hn`} />
      </div>
      <svg
        onClick={() => onDelete(fakeAtHnSocial)}
        className="mt-2 h-5 cursor-pointer fill-current"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 -960 960 960"
        width="24px"
      >
        <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
      </svg>
    </div>
  );
}
