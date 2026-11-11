"use client";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useEffect, useRef, useState } from "react";

import { debouncedFetchCities } from "@/app/_db/City.client";
import { CityWithoutMetadata } from "@/app/_db/schema";
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
  onSelect: (city: CityWithoutMetadata) => any;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [cities, setCities] = useState<
    (CityWithoutMetadata & { addresstype: string })[]
  >([]);
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
    // Nominatim can return the same place as several OSM objects with different
    // addresstypes (e.g. "city", "suburb", "city_district"), each with its own
    // lat/lon — hence its own id/URL. We collapse entries sharing a fullName into
    // a single one, preferring the "city" addresstype so a place always maps to
    // one stable id (and one URL).
    const byFullName = new Map<string, (typeof cities)[number]>();
    for (const city of cities) {
      const existing = byFullName.get(city.fullName);
      if (
        !existing ||
        (existing.addresstype !== "city" && city.addresstype === "city")
      ) {
        byFullName.set(city.fullName, city);
      }
    }
    setCities(
      // We want cities ranked first as an incentive for users to select cities
      [...byFullName.values()].sort((a, b) => {
        const aIsCity = a.addresstype === "city";
        const bIsCity = b.addresstype === "city";
        return aIsCity === bIsCity ? 0 : aIsCity ? -1 : 1;
      }),
    );
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
