"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface TimePickerProps {
  value?: { hour: number; minute: number };
  onChange?: (time: { hour: number; minute: number }) => void;
  placeholder?: string;
}

export function TimePicker({
  value,
  onChange,
  placeholder = "Select time",
}: TimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  const displayHour = value ? (value.hour % 12 === 0 ? 12 : value.hour % 12) : null;
  const isAM = value ? value.hour < 12 : true;

  const handleHourChange = (hour: number) => {
    const current = value || { hour: 9, minute: 0 };
    const newHour = isAM ? (hour % 12) : (hour % 12) + 12;
    onChange?.({ ...current, hour: newHour });
  };

  const handleMinuteChange = (minute: number) => {
    const current = value || { hour: 9, minute: 0 };
    onChange?.({ ...current, minute });
  };

  const handleAmPmChange = (ampm: "AM" | "PM") => {
    if (!value) {
      onChange?.({ hour: ampm === "AM" ? 9 : 21, minute: 0 });
    } else {
      const currentHour = value.hour;
      if (ampm === "PM" && currentHour < 12) {
        onChange?.({ ...value, hour: currentHour + 12 });
      } else if (ampm === "AM" && currentHour >= 12) {
        onChange?.({ ...value, hour: currentHour - 12 });
      }
    }
    setIsOpen(false);
  };

  const formatTime = () => {
    if (!value) return null;
    const hour = value.hour % 12 === 0 ? 12 : value.hour % 12;
    const minute = value.minute.toString().padStart(2, "0");
    const ampm = value.hour >= 12 ? "PM" : "AM";
    return `${hour}:${minute} ${ampm}`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {formatTime() || <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex h-[200px] divide-x">
          <ScrollArea className="w-auto">
            <div className="flex flex-col p-2">
              {hours.map((hour) => (
                <Button
                  key={hour}
                  size="icon"
                  variant={displayHour === hour ? "default" : "ghost"}
                  className="w-full shrink-0 aspect-square"
                  onClick={() => handleHourChange(hour)}
                >
                  {hour}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
          <ScrollArea className="w-auto">
            <div className="flex flex-col p-2">
              {minutes.map((minute) => (
                <Button
                  key={minute}
                  size="icon"
                  variant={value?.minute === minute ? "default" : "ghost"}
                  className="w-full shrink-0 aspect-square"
                  onClick={() => handleMinuteChange(minute)}
                >
                  {minute.toString().padStart(2, "0")}
                </Button>
              ))}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
          <div className="flex flex-col p-2">
            {(["AM", "PM"] as const).map((ampm) => (
              <Button
                key={ampm}
                size="icon"
                variant={
                  value && ((ampm === "AM" && !isAM) || (ampm === "PM" && isAM))
                    ? "ghost"
                    : value
                    ? "default"
                    : "ghost"
                }
                className="w-full shrink-0 aspect-square"
                onClick={() => handleAmPmChange(ampm)}
              >
                {ampm}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
