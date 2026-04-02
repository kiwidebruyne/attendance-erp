"use client";

import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import type { AdminRequestItem } from "../_lib/formatting";
import { formatDateShortLabel } from "../_lib/formatting";

type FilterOption = Readonly<{
  label: string;
  value: string;
}>;

type TextFilterControl = Readonly<{
  kind: "text";
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}>;

type DateRangeFilterControl = Readonly<{
  kind: "date_range";
  from: string;
  label: string;
  onFromChange: (value: string) => void;
  onPresetChange: (value: string) => void;
  onToChange: (value: string) => void;
  preset: string;
  presetOptions: FilterOption[];
  to: string;
}>;

type SelectFilterControl = Readonly<{
  kind: "select";
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}>;

type TableFilterControl =
  | DateRangeFilterControl
  | SelectFilterControl
  | TextFilterControl;

export type AdminRequestReviewTableColumn<TItem extends AdminRequestItem> =
  Readonly<{
    cellClassName?: string;
    filter?: TableFilterControl;
    header: string;
    key: string;
    renderCell: (item: TItem) => ReactNode;
  }>;

type AdminRequestReviewTableSectionProps<TItem extends AdminRequestItem> =
  Readonly<{
    columns: AdminRequestReviewTableColumn<TItem>[];
    description: string;
    emptyDescription: string;
    emptyTitle: string;
    isBusy?: boolean;
    items: TItem[];
    onRequestSelect: (requestId: string) => void;
    onResetFilters: () => void;
    selectedRequestId: string | null;
    title: string;
    totalCount: number;
  }>;

function countLabel(totalCount: number, visibleCount: number) {
  return `총 ${totalCount}건 중 ${visibleCount}건`;
}

function getDateRangeSummary(control: DateRangeFilterControl) {
  const presetLabel =
    control.presetOptions.find((option) => option.value === control.preset)
      ?.label ?? null;

  if (presetLabel !== null && control.preset.length > 0) {
    return presetLabel;
  }

  if (control.from.length > 0 && control.to.length > 0) {
    return `${formatDateShortLabel(control.from)}-${formatDateShortLabel(
      control.to,
    )}`;
  }

  if (control.from.length > 0) {
    return `${formatDateShortLabel(control.from)} 이후`;
  }

  if (control.to.length > 0) {
    return `${formatDateShortLabel(control.to)} 이전`;
  }

  return null;
}

function getFilterSummary(control: TableFilterControl) {
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

  return getDateRangeSummary(control);
}

function buildActiveFilterSummaries(
  columns: AdminRequestReviewTableColumn<AdminRequestItem>[],
) {
  return columns.flatMap((column) => {
    if (column.filter === undefined) {
      return [];
    }

    const summary = getFilterSummary(column.filter);

    if (summary === null) {
      return [];
    }

    return [`${column.header}: ${summary}`];
  });
}

function FilterSelect({
  control,
  disabled = false,
}: Readonly<{
  control: SelectFilterControl;
  disabled?: boolean;
}>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-xl border border-input bg-card px-3.5 py-2 text-sm text-foreground outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/30 disabled:opacity-50",
      )}
      disabled={disabled}
      value={control.value}
      onChange={(event) => control.onChange(event.target.value)}
    >
      {control.options.map((option) => (
        <option key={option.value || "__empty"} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function DateRangeFilterForm({
  control,
  disabled = false,
}: Readonly<{
  control: DateRangeFilterControl;
  disabled?: boolean;
}>) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-medium text-muted-foreground">
          빠른 기간
        </Label>
        <ToggleGroup
          className="w-full justify-start"
          disabled={disabled}
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
            htmlFor={`${control.label}-from`}
          >
            시작일
          </Label>
          <Input
            disabled={disabled}
            id={`${control.label}-from`}
            type="date"
            value={control.from}
            onChange={(event) => control.onFromChange(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label
            className="text-xs font-medium text-muted-foreground"
            htmlFor={`${control.label}-to`}
          >
            종료일
          </Label>
          <Input
            disabled={disabled}
            id={`${control.label}-to`}
            type="date"
            value={control.to}
            onChange={(event) => control.onToChange(event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function FilterPopoverBody({
  control,
  disabled = false,
}: Readonly<{
  control: TableFilterControl;
  disabled?: boolean;
}>) {
  if (control.kind === "select") {
    return <FilterSelect control={control} disabled={disabled} />;
  }

  if (control.kind === "date_range") {
    return <DateRangeFilterForm control={control} disabled={disabled} />;
  }

  return (
    <Input
      disabled={disabled}
      placeholder={control.placeholder}
      value={control.value}
      onChange={(event) => control.onChange(event.target.value)}
    />
  );
}

function FilterableHeader({
  control,
  disabled = false,
  header,
}: Readonly<{
  control: TableFilterControl;
  disabled?: boolean;
  header: string;
}>) {
  const isActive = getFilterSummary(control) !== null;

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
            현재 표에만 적용되고 다른 요청 표에는 영향을 주지 않아요
          </PopoverDescription>
        </PopoverHeader>
        <FilterPopoverBody control={control} disabled={disabled} />
      </PopoverContent>
    </Popover>
  );
}

export function AdminRequestReviewTableSection<TItem extends AdminRequestItem>(
  props: AdminRequestReviewTableSectionProps<TItem>,
) {
  const {
    columns,
    description,
    emptyDescription,
    emptyTitle,
    isBusy = false,
    items,
    onRequestSelect,
    onResetFilters,
    selectedRequestId,
    title,
    totalCount,
  } = props;
  const activeFilterSummaries = buildActiveFilterSummaries(
    columns as AdminRequestReviewTableColumn<AdminRequestItem>[],
  );

  return (
    <Card className="gap-0">
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="outline">
            {countLabel(totalCount, items.length)}
          </Badge>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-3 rounded-[14px] border border-border/80 bg-surface-subtle/45 p-4">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {activeFilterSummaries.length > 0 ? (
              activeFilterSummaries.map((summary) => (
                <Badge key={summary} variant="outline">
                  {summary}
                </Badge>
              ))
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                열 제목을 눌러 이 표만 필터해요
              </p>
            )}
          </div>

          <Button
            disabled={isBusy || activeFilterSummaries.length === 0}
            size="sm"
            type="button"
            variant="outline"
            onClick={onResetFilters}
          >
            필터 초기화
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {items.length === 0 ? (
          <Empty className="border border-dashed border-border/80 bg-surface-subtle/35 py-12">
            <EmptyHeader>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key}>
                    {column.filter === undefined ? (
                      <span>{column.header}</span>
                    ) : (
                      <FilterableHeader
                        control={column.filter}
                        disabled={isBusy}
                        header={column.header}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const isSelected = item.id === selectedRequestId;

                return (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "cursor-pointer",
                      isBusy && "pointer-events-none opacity-70",
                      isSelected &&
                        "bg-primary/5 hover:bg-primary/10 data-[state=selected]:bg-primary/5",
                    )}
                    data-state={isSelected ? "selected" : undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => onRequestSelect(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onRequestSelect(item.id);
                      }
                    }}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(column.cellClassName)}
                      >
                        {column.renderCell(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <CardFooter className="justify-between">
        <span className="text-xs text-muted-foreground">
          {activeFilterSummaries.length > 0
            ? "적용한 조건은 현재 표에만 유지돼요"
            : "필터는 열 제목에서 바로 열 수 있어요"}
        </span>
        <span className="text-xs text-muted-foreground">
          {countLabel(totalCount, items.length)}
        </span>
      </CardFooter>
    </Card>
  );
}
