"use client";

import { CheckCheckIcon, CircleAlertIcon, ShieldAlertIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FoundationInteractiveShowcase() {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Client-only primitives</CardDescription>
        <CardTitle>Dialog, confirmation, and filter controls</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,240px)_1fr]">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Request filter
          </span>
          <Select defaultValue="pending">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a queue" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Request queues</SelectLabel>
                <SelectItem value="pending">Pending review</SelectItem>
                <SelectItem value="approved">Approved requests</SelectItem>
                <SelectItem value="rejected">Rejected requests</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button type="button">
                <CheckCheckIcon data-icon="inline-start" />
                Open approval dialog
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Approve manual attendance request</DialogTitle>
                <DialogDescription>
                  Confirm the employee arrived during the BLE outage window and
                  mark the check-in as verified.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Keep pending
                  </Button>
                </DialogClose>
                <Button type="button">Approve request</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline">
                <ShieldAlertIcon data-icon="inline-start" />
                Open rejection alert
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia>
                  <CircleAlertIcon />
                </AlertDialogMedia>
                <AlertDialogTitle>Reject this request?</AlertDialogTitle>
                <AlertDialogDescription>
                  Rejection requires a reason in the final screen. This preview
                  keeps the destructive confirmation isolated in a client leaf.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive">
                  Reject request
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
