"use client"

import * as React from "react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { Sun, Moon } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <Button variant="outline" size="icon" className="cursor-pointer" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <Moon className="absolute h-10 w-10 rotate-0 scale-100 dark:-rotate-90 dark:scale-0"></Moon>
      <Sun className="absolute h-10 w-10 rotate-90 scale-0 dark:-rotate-0 dark:scale-100"></Sun>
    </Button>   
  )
}
