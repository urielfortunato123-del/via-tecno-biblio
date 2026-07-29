import { createContext, useContext, useState, type ReactNode } from "react";

interface InspectionCtx {
  activeInspectionId: number | null;
  setActiveInspectionId: (id: number | null) => void;
  bibliotecaOpen: boolean;
  setBibliotecaOpen: (v: boolean) => void;
}

const Ctx = createContext<InspectionCtx | null>(null);

export function InspectionProvider({ children }: { children: ReactNode }) {
  const [activeInspectionId, setActiveInspectionId] = useState<number | null>(null);
  const [bibliotecaOpen, setBibliotecaOpen] = useState(false);
  return (
    <Ctx.Provider
      value={{ activeInspectionId, setActiveInspectionId, bibliotecaOpen, setBibliotecaOpen }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useInspection() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInspection outside InspectionProvider");
  return ctx;
}
