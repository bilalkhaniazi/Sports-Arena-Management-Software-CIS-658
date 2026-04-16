import React from "react";
import { FaUmbrellaBeach } from "react-icons/fa";

type Props = {
  label?: string | null;
  message?: string;
  onNextDay: () => void;
  onFindNextOpen?: () => void;
  findNextBusy?: boolean;
};

const HolidayDayBanner: React.FC<Props> = ({
  label,
  message,
  onNextDay,
  onFindNextOpen,
  findNextBusy,
}) => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
    <div className="flex items-start gap-3">
      <FaUmbrellaBeach
        className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
        aria-hidden
      />
      <div className="min-w-0">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          This day is an arena holiday — closed for bookings
        </p>
        <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-300/90">
          {message ||
            (label
              ? `${label}`
              : "No time slots can be booked on this date. Choose another day.")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onNextDay}
            className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            Next day
          </button>
          {onFindNextOpen ? (
            <button
              type="button"
              disabled={findNextBusy}
              onClick={onFindNextOpen}
              className="rounded-lg border border-amber-700 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500 dark:text-amber-200 dark:hover:bg-amber-900/40"
            >
              {findNextBusy ? "Searching…" : "Find next day"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  </div>
);

export default HolidayDayBanner;
