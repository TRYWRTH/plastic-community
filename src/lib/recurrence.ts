import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type RepeatOption = "none" | "weekly" | "biweekly" | "monthly";

export const REPEAT_OPTIONS: { value: RepeatOption; label: string }[] = [
  { value: "none", label: "None" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

type BaseEvent = Database["public"]["Tables"]["events"]["Insert"];

/**
 * Generate future instance dates up to ~3 months ahead based on the repeat option.
 * Excludes the original date (caller already inserted that).
 */
export function generateRecurrenceDates(start: Date, repeats: RepeatOption): Date[] {
  if (repeats === "none") return [];
  const horizon = new Date(start);
  horizon.setMonth(horizon.getMonth() + 3);

  const dates: Date[] = [];
  const cursor = new Date(start);

  while (true) {
    if (repeats === "weekly") cursor.setDate(cursor.getDate() + 7);
    else if (repeats === "biweekly") cursor.setDate(cursor.getDate() + 14);
    else if (repeats === "monthly") cursor.setMonth(cursor.getMonth() + 1);
    if (cursor > horizon) break;
    dates.push(new Date(cursor));
  }
  return dates;
}

/**
 * Create future event instances for a repeating event.
 * Future copies are saved with repeats='none' so they don't recurse.
 */
export async function createRecurringInstances(
  base: Omit<BaseEvent, "event_date" | "repeats">,
  startDate: Date,
  repeats: RepeatOption,
): Promise<number> {
  const dates = generateRecurrenceDates(startDate, repeats);
  if (dates.length === 0) return 0;

  const rows = dates.map((d) => ({
    ...base,
    event_date: d.toISOString(),
    repeats: "none" as const,
  }));

  const { error } = await supabase.from("events").insert(rows);
  if (error) {
    console.error("[recurrence] failed to insert future instances", error);
    return 0;
  }
  return rows.length;
}
