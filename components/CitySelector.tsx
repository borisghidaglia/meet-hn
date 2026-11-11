"use client";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useEffect, useRef, useState } from "react";

import { debouncedFetchCities, PickerResult } from "@/app/_db/City.client";
import { FormCity } from "@/app/_db/schema";
import { pickerList } from "@/app/_lib/nominatim";
import { cn } from "@/app/_lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { Input } from "@/components/ui/input";

export function CitySelector({
  initialValue,
  onSelect,
}: {
  initialValue?: string;
  onSelect: (city: FormCity) => any;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [cities, setCities] = useState<PickerResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        commandRef.current &&
        e.target instanceof Node &&
        !commandRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (["Escape", "Tab"].includes(event.key)) setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setIsOpen(true);
    const cities = await debouncedFetchCities(e.target.value);
    if (!cities) {
      setCities([]);
      return;
    }
    // Several OSM objects can share a label (Paris: commune, city, district).
    // One entry per label keeps the list readable; whichever object is picked,
    // the server resolves it to the existing page (app/_lib/resolvePlace.ts).
    setCities(pickerList(cities));
  };

  return (
    <Command
      ref={commandRef}
      className="relative overflow-visible bg-transparent"
    >
      <div className="grid">
        <Input
          ref={inputRef}
          placeholder="Search location"
          className={cn(
            "border-[#99999a] pr-8 [grid-area:1/1] focus-visible:ring-0",
            isOpen ? "rounded-b-none border-b-0" : "",
          )}
          onFocus={() => setIsOpen(true)}
          value={value}
          onChange={handleChange}
        />
        <MagnifyingGlassIcon className="mr-2 h-4 w-4 shrink-0 self-center justify-self-end opacity-50 [grid-area:1/1]" />
      </div>
      <CommandList
        className={cn(
          "absolute top-full z-50 w-full rounded-b-md rounded-t-none border border-t-0 border-[#99999a] bg-[#f6f6ef]",
          isOpen ? "block" : "hidden",
        )}
      >
        <CommandEmpty>
          Built with{" "}
          <ExternalLink
            className="font-semibold"
            href="https://nominatim.openstreetmap.org/ui/search.html"
          >
            nominatim.openstreetmap.org
          </ExternalLink>
        </CommandEmpty>
        <CommandGroup>
          {cities.map((city, idx) => (
            <CommandItem
              key={city.id}
              data-testid={`city-selector-res-${idx}`}
              onSelect={() => {
                // We don't want to propagate addresstype further
                const { addresstype, ...bareCity } = city;
                onSelect(bareCity);
                setIsOpen(false);
                setValue(city.fullName);
                inputRef.current?.blur();
              }}
            >
              <div className="grid w-full grid-cols-[1fr,min-content]">
                <p>{city.fullName}</p>
                <span className="place-self-end text-xs opacity-50">
                  {city.addresstype}
                </span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
