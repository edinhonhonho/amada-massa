"use client";

import { useEffect, useState } from "react";

/** Nome da tecla de atalho principal: "⌘" no Mac e no iPhone, "Ctrl" nos demais. */
export function useModificador(): string {
  const [mod, setMod] = useState("Ctrl");
  useEffect(() => {
    if (/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)) setMod("⌘");
  }, []);
  return mod;
}
