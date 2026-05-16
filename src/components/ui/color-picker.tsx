"use client";

import { useEffect, useMemo, useState } from "react";
import { Paintbrush, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const DEFAULT_SWATCHES = [
  "#F97316",
  "#EF4444",
  "#EAB308",
  "#22C55E",
  "#06B6D4",
  "#0EA5E9",
  "#6366F1",
  "#A855F7",
  "#EC4899",
  "#94A3B8",
  "#64748B",
  "#334155",
];

const normalizeColor = (value?: string | null) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().toUpperCase();
  return /^#([0-9A-F]{6})$/.test(trimmed) ? trimmed : "";
};

type ColorPickerProps = {
  value?: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export function ColorPicker({
  value,
  onChange,
  disabled = false,
  label = "Pick color",
  className,
}: ColorPickerProps) {
  const normalizedValue = useMemo(() => normalizeColor(value), [value]);
  const [draft, setDraft] = useState(normalizedValue);

  useEffect(() => {
    setDraft(normalizedValue);
  }, [normalizedValue]);

  const commit = (nextValue: string) => {
    const normalized = normalizeColor(nextValue);
    setDraft(normalized);
    onChange(normalized);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-between gap-3", className)}
        >
          <span className="flex items-center gap-3">
            <span
              className="h-5 w-5 rounded-md border border-border/70"
              style={{
                backgroundColor: normalizedValue || "transparent",
                backgroundImage: normalizedValue
                  ? undefined
                  : "linear-gradient(135deg, transparent 45%, rgb(239 68 68) 45%, rgb(239 68 68) 55%, transparent 55%)",
              }}
            />
            <span className="text-sm">
              {normalizedValue ? "Color selected" : "No color"}
            </span>
          </span>
          <Paintbrush className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-4" align="start">
        <div className="space-y-2">
          <Label>{label}</Label>
          <div className="grid grid-cols-6 gap-2">
            {DEFAULT_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                className={cn(
                  "h-9 w-9 rounded-md border transition-transform hover:scale-105",
                  normalizedValue === swatch
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border/70",
                )}
                style={{ backgroundColor: swatch }}
                onClick={() => commit(swatch)}
                disabled={disabled}
                aria-label={`Select ${swatch}`}
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="color-picker-native">Custom color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="color-picker-native"
              type="color"
              value={normalizedValue || "#000000"}
              disabled={disabled}
              onChange={(event) => commit(event.target.value)}
              className="h-10 w-14 p-1"
            />
            <Input
              value={draft}
              disabled={disabled}
              placeholder="#F97316"
              onChange={(event) => setDraft(event.target.value.toUpperCase())}
              onBlur={() => commit(draft)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => commit("")}
            disabled={disabled || !normalizedValue}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Clear color
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
