"use client";

import { createContext, useContext, useState } from "react";
import { Button } from "./ui/button";

export const GroupToggleContext = createContext<boolean>(false);

export function GroupToggle({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <GroupToggleContext.Provider value={isOpen}>
      <Button onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? "Hide about" : "Show about"}
      </Button>
      {children}
    </GroupToggleContext.Provider>
  );
}

export function GroupToggleItem({ children }: { children: React.ReactNode }) {
  const isOpen = useContext(GroupToggleContext);
  return isOpen ? children : null;
}
