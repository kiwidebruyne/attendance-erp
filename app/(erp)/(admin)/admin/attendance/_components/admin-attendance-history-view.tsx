"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminAttendanceListResponse } from "@/lib/contracts/admin-attendance";

import {
  formatMinutesLabel,
  formatTimeLabel,
  getHistoryDisplayStatusLabel,
} from "../_lib/formatting";

type AdminAttendanceHistoryViewProps = {
  from: string;
  name?: string;
  onFromChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onToChange: (value: string) => void;
  response: AdminAttendanceListResponse;
  to: string;
};

export function AdminAttendanceHistoryView({
  from,
  name,
  onFromChange,
  onNameChange,
  onToChange,
  response,
  to,
}: AdminAttendanceHistoryViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="이력 필터"
        className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-3"
      >
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          이름
          <Input
            autoComplete="off"
            value={name ?? ""}
            name="name"
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="이름으로 찾기"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          시작일
          <Input
            autoComplete="off"
            value={from}
            name="from"
            onChange={(event) => onFromChange(event.target.value)}
            type="date"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          종료일
          <Input
            autoComplete="off"
            value={to}
            name="to"
            onChange={(event) => onToChange(event.target.value)}
            type="date"
          />
        </label>
      </section>

      {response.records.length === 0 ? (
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyTitle>조건에 맞는 근태 이력이 없어요.</EmptyTitle>
            <EmptyDescription>
              이름이나 날짜 범위를 바꾸면 다른 기록을 바로 확인할 수 있어요.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <section className="rounded-xl border border-border bg-card p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>기준 시간</TableHead>
                <TableHead>출근</TableHead>
                <TableHead>퇴근</TableHead>
                <TableHead>근무 시간</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {response.records.map((record) => (
                <TableRow key={`${record.date}-${record.employee.id}`}>
                  <TableCell>{record.date}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">
                        {record.employee.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {record.employee.department}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {record.expectedWorkday.adjustedClockInAt === null &&
                    record.expectedWorkday.adjustedClockOutAt === null
                      ? "휴가 반영"
                      : `${formatTimeLabel(record.expectedWorkday.adjustedClockInAt)} ~ ${formatTimeLabel(record.expectedWorkday.adjustedClockOutAt)}`}
                  </TableCell>
                  <TableCell>
                    {formatTimeLabel(record.record?.clockInAt ?? null)}
                  </TableCell>
                  <TableCell>
                    {formatTimeLabel(record.record?.clockOutAt ?? null)}
                  </TableCell>
                  <TableCell>
                    {formatMinutesLabel(record.record?.workMinutes ?? null)}
                  </TableCell>
                  <TableCell>
                    {getHistoryDisplayStatusLabel(record.display)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </div>
  );
}
