import { useCallback } from "react";

function parseCustomDate(dateStr) {
  if (!dateStr) return new Date(NaN);

  // Handle "DD Mon YYYY" format → "25 Mar 2026"
  const customMatch = dateStr.match(/^(\d{1,2})\s([A-Za-z]{3})\s(\d{4})$/);
  if (customMatch) {
    const months = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3,
      May: 4, Jun: 5, Jul: 6, Aug: 7,
      Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const [, day, monthStr, year] = customMatch;
    const monthIndex = months[monthStr];
    if (monthIndex === undefined) return new Date(NaN);
    // Use UTC noon to avoid timezone-related day shifts
    return new Date(Number(year), monthIndex, parseInt(day, 10), 12, 0, 0);
  }

  // Fallback: try native parsing (ISO format etc.)
  const fallback = new Date(dateStr);
  return fallback;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function useDateFilter(timeFilter) {
  return useCallback((dateStr) => {
    if (timeFilter === "All") return true;

    const now = new Date();
    const leadDate = parseCustomDate(dateStr);

    if (isNaN(leadDate.getTime())) return false;

    switch (timeFilter) {
      case "Daily":
        // Compare date strings to avoid time-of-day issues
        return startOfDay(leadDate).getTime() === startOfDay(now).getTime();

      case "Weekly": {
        const oneWeekAgo = startOfDay(new Date());
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);
        return leadDate >= oneWeekAgo && leadDate <= endOfToday;
      }

      case "Monthly":
        return (
          leadDate.getMonth() === now.getMonth() &&
          leadDate.getFullYear() === now.getFullYear()
        );

      case "Quarterly": {
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const leadQuarter = Math.floor(leadDate.getMonth() / 3);
        return (
          leadQuarter === currentQuarter &&
          leadDate.getFullYear() === now.getFullYear()
        );
      }

      default:
        return true;
    }
  }, [timeFilter]);
}