"use client";

import { createContext, useContext, useState } from "react";

export const GroupToggleContext = createContext<boolean>(false);

export function GroupToggle({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  return (
    <GroupToggleContext.Provider value={isOpen}>
      <div className="flex flex-col gap-5">
        <div
          className="flex flex-nowrap gap-2 self-end"
          onClick={() => () => setIsOpen(!isOpen)}
        >
          <label htmlFor="show-interests">
            {isOpen ? "Hide interests" : "Show interests"}
          </label>
          <input
            id="show-interests"
            type="checkbox"
            checked={isOpen}
            onChange={(e) => setIsOpen(e.target.checked)}
          />
        </div>
        {children}
      </div>
    </GroupToggleContext.Provider>
  );
}

export function GroupToggleItem({ children }: { children: React.ReactNode }) {
  const isOpen = useContext(GroupToggleContext);
  return isOpen ? children : null;
}
