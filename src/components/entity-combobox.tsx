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

interface EntityOption {
  id: string;
  name: string;
  tax_id: string;
}

interface EntityComboboxProps {
  entities: EntityOption[];
  value: string;
  onChange: (entityId: string) => void;
}

export function EntityCombobox({
  entities,
  value,
  onChange,
}: EntityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (entities.length <= 1) return null;

  const selected = entities.find((e) => e.id === value);
  const filtered = entities.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.tax_id.includes(search)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-start font-normal"
        >
          {selected
            ? `${selected.name}（${selected.tax_id}）`
            : "選擇公司統編..."}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜尋公司名稱或統編..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>找不到符合的公司</CommandEmpty>
            <CommandGroup>
              {filtered.map((e) => (
                <CommandItem
                  key={e.id}
                  value={e.id}
                  onSelect={() => {
                    onChange(e.id);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  {e.name}（{e.tax_id}）
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
