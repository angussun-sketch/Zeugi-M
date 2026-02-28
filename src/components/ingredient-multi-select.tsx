"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface IngredientMultiSelectProps {
  ingredients: { id: string; name: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}

export function IngredientMultiSelect({
  ingredients,
  value,
  onChange,
}: IngredientMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = ingredients.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  const selectedNames = ingredients
    .filter((i) => value.includes(i.id))
    .map((i) => i.name);

  const label =
    selectedNames.length === 0
      ? "選擇品項..."
      : selectedNames.length <= 2
        ? selectedNames.join("、")
        : `已選 ${selectedNames.length} 項`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start font-normal"
        >
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜尋原料..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>無符合的原料</CommandEmpty>
            <CommandGroup>
              {filtered.map((ing) => (
                <CommandItem
                  key={ing.id}
                  value={ing.id}
                  onSelect={() => toggle(ing.id)}
                >
                  <Checkbox
                    checked={value.includes(ing.id)}
                    className="mr-2 pointer-events-none"
                  />
                  {ing.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {value.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => onChange([])}
            >
              清除選取
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
