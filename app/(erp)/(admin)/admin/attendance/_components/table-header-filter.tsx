"use client";

import { ChevronDownIcon } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type TableFilterOption = Readonly<{
  label: string;
  value: string;
}>;

export type TableHeaderTextFilter = Readonly<{
  kind: "text";
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}>;

export type TableHeaderSelectFilter = Readonly<{
  kind: "select";
  label: string;
  options: readonly TableFilterOption[];
  value: string;
  onChange: (value: string) => void;
}>;

export type TableHeaderDateRangeFilter = Readonly<{
  kind: "date_range";
  from: string;
  label: string;
  onFromChange: (value: string) => void;
  onPresetChange: (value: string) => void;
  onToChange: (value: string) => void;
  onClear?: () => void;
  preset: string;
  presetOptions: readonly TableFilterOption[];
  to: string;
}>;

export type TableHeaderFilter =
  | TableHeaderDateRangeFilter
  | TableHeaderSelectFilter
  | TableHeaderTextFilter;

function getFilterSummary(control: TableHeaderFilter) {
  if (control.kind === "text") {
    return control.value.trim().length === 0 ? null : control.value.trim();
  }

  if (control.kind === "select") {
    if (control.value.length === 0) {
      return null;
    }

    return (
      control.options.find((option) => option.value === control.value)?.label ??
      null
    );
  }

  if (control.preset.length > 0) {
    return (
      control.presetOptions.find((option) => option.value === control.preset)
        ?.label ?? null
    );
  }

  if (control.from.length > 0 && control.to.length > 0) {
    return `${control.from} ~ ${control.to}`;
  }

  if (control.from.length > 0) {
    return `${control.from} 이후`;
  }

  if (control.to.length > 0) {
    return `${control.to} 이전`;
  }

  return null;
}

function FilterBody({
  control,
}: Readonly<{
  control: TableHeaderFilter;
}>) {
  const fieldId = useId();
  const fieldName = `${control.label}-${control.kind}`;

  if (control.kind === "select") {
    return (
      <div className="flex flex-col gap-2">
        <Label
          className="text-xs font-medium text-muted-foreground"
          htmlFor={fieldId}
        >
          {control.label}
        </Label>
        <select
          autoComplete="off"
          className={cn(
            "h-10 w-full rounded-xl border border-input bg-card px-3.5 py-2 text-sm text-foreground outline-none transition-colors",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
          )}
          id={fieldId}
          name={fieldName}
          value={control.value}
          onChange={(event) => control.onChange(event.target.value)}
        >
          {control.options.map((option) => (
            <option key={option.value || "__empty"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (control.kind === "date_range") {
    const fromId = `${fieldId}-from`;
    const toId = `${fieldId}-to`;

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-medium text-muted-foreground">
            빠른 기간
          </Label>
          <ToggleGroup
            className="w-full justify-start"
            size="sm"
            type="single"
            value={control.preset}
            variant="outline"
            onValueChange={(value) => control.onPresetChange(value)}
          >
            {control.presetOptions.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value}>
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={fromId}
            >
              시작일
            </Label>
            <Input
              autoComplete="off"
              id={fromId}
              name={`${fieldName}-from`}
              type="date"
              value={control.from}
              onChange={(event) => control.onFromChange(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label
              className="text-xs font-medium text-muted-foreground"
              htmlFor={toId}
            >
              종료일
            </Label>
            <Input
              autoComplete="off"
              id={toId}
              name={`${fieldName}-to`}
              type="date"
              value={control.to}
              onChange={(event) => control.onToChange(event.target.value)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label
        className="text-xs font-medium text-muted-foreground"
        htmlFor={fieldId}
      >
        {control.label}
      </Label>
      <Input
        autoComplete="off"
        id={fieldId}
        name={fieldName}
        placeholder={control.placeholder}
        value={control.value}
        onChange={(event) => control.onChange(event.target.value)}
      />
    </div>
  );
}

export function TableHeaderFilterButton({
  control,
  disabled = false,
  header,
}: Readonly<{
  control: TableHeaderFilter;
  disabled?: boolean;
  header: string;
}>) {
  const summary = getFilterSummary(control);
  const isActive = summary !== null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={`${header} 필터`}
          className={cn(
            "h-auto min-h-9 w-full justify-between rounded-[12px] border px-3 py-2 text-[11px] font-medium",
            isActive
              ? "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              : "border-transparent bg-transparent text-muted-foreground hover:border-border/80 hover:bg-muted/60 hover:text-foreground",
          )}
          disabled={disabled}
          size="sm"
          type="button"
          variant="ghost"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{header}</span>
            {isActive ? (
              <span className="size-1.5 rounded-full bg-primary" />
            ) : null}
          </span>
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] gap-4 p-4">
        <PopoverHeader className="gap-1">
          <PopoverTitle>{control.label} 필터</PopoverTitle>
          <PopoverDescription>
            이 조건은 현재 표에만 적용돼요
          </PopoverDescription>
        </PopoverHeader>
        <FilterBody control={control} />
        {control.kind === "date_range" && control.onClear !== undefined ? (
          <div className="flex justify-end">
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={control.onClear}
            >
              초기화
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
