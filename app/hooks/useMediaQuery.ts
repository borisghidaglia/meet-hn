import { useState, useEffect } from "react";

// from: https://github.com/shadcn-ui/ui/blob/9f156a1b890cc043b8fe01037abb6625bd3f588a/apps/www/hooks/use-media-query.tsx
export function useMediaQuery(query: string) {
  const [value, setValue] = useState(false);

  useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }

    const result = matchMedia(query);
    result.addEventListener("change", onChange);
    setValue(result.matches);

    return () => result.removeEventListener("change", onChange);
  }, [query]);

  return value;
}
