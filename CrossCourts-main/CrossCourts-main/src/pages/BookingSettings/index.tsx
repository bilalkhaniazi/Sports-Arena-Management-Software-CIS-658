import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "react-toastify";
import Breadcrumb from "../../components/Breadcrumbs/Breadcrumb";
import {
  FaBuilding,
  FaCalendarAlt,
  FaClipboardList,
  FaClock,
  FaCoffee,
  FaMagic,
  FaPlus,
  FaTrash,
  FaEdit,
  FaStopwatch,
  FaUmbrellaBeach,
  FaLayerGroup,
  FaSyncAlt,
  FaUndo,
} from "react-icons/fa";

const API_BASE_URL = "http://localhost:5000/api";
const getBackofficeScope = () =>
  window.location.pathname.startsWith("/admin") ? "admin" : "operator";

/** Avoid `Unexpected token '<'` when the server returns an HTML error page. */
async function parseApiJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  const ct = res.headers.get("content-type") || "";
  const trimmed = text.trimStart();
  if (
    ct.includes("text/html") ||
    (trimmed.startsWith("<") && !trimmed.startsWith("{"))
  ) {
    throw new Error(
      `The API returned HTML instead of JSON (${res.status}). Restart the backend (node server.js) so routes are up to date, and confirm the app calls ${API_BASE_URL}.`,
    );
  }
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      res.ok
        ? "Invalid JSON from server."
        : `Request failed (${res.status}): ${text.slice(0, 160)}`,
    );
  }
}

type ArenaRow = {
  id: number;
  name: string;
  city: string | null;
  status: string;
};

type CourtRow = {
  id: number;
  name: string;
  sport_name: string | null;
  is_deleted: number;
};

type CustomSlot = {
  id: number;
  court_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  is_arena_holiday?: boolean;
};

type Holiday = {
  id: number;
  holiday_date: string;
  label: string | null;
};

type SlotTemplateRow = {
  id: number;
  start_time: string;
  end_time: string;
};

type TimePair = { start_time: string; end_time: string };

/** Minutes from 00:00; "24:00" parses as end-of-day (1440). Accepts HH:MM:SS from time inputs. */
function parseFlexibleTimeToMinutes(s: string): number | null {
  const raw = String(s).trim();
  const parts = raw.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const mi = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(mi)) return null;
  if (h === 24 && mi === 0) return 24 * 60;
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** HH:MM for pattern rows (allows 24:00 for last slot end). */
function minutesToPatternTime(totalMin: number): string {
  if (totalMin >= 24 * 60) return "24:00";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function rangesOverlapHalfOpen(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

function buildSlotsFromInterval(params: {
  intervalMinutes: number;
  openMinutes: number;
  closeMinutes: number;
  breakStart: number | null;
  breakEnd: number | null;
}): TimePair[] {
  const { intervalMinutes, openMinutes, closeMinutes } = params;
  let breakStart = params.breakStart;
  let breakEnd = params.breakEnd;
  if (
    breakStart != null &&
    breakEnd != null &&
    breakStart >= breakEnd
  ) {
    breakStart = null;
    breakEnd = null;
  }

  if (
    intervalMinutes < 5 ||
    openMinutes < 0 ||
    closeMinutes <= openMinutes ||
    closeMinutes > 24 * 60
  ) {
    return [];
  }

  const out: TimePair[] = [];
  let cur = openMinutes;
  while (cur + intervalMinutes <= closeMinutes) {
    const slotEnd = cur + intervalMinutes;
    let hitBreak = false;
    if (breakStart != null && breakEnd != null) {
      hitBreak = rangesOverlapHalfOpen(cur, slotEnd, breakStart, breakEnd);
    }
    if (!hitBreak) {
      out.push({
        start_time: minutesToPatternTime(cur),
        end_time: minutesToPatternTime(slotEnd),
      });
    }
    cur += intervalMinutes;
  }
  return out;
}

function todayYmd(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function addMonthsYmd(base: string, months: number): string {
  const d = parseISO(base);
  d.setMonth(d.getMonth() + months);
  return format(d, "yyyy-MM-dd");
}

const BookingSettings: React.FC = () => {
      const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scope = getBackofficeScope();

  const [arenaId, setArenaId] = useState<number | null>(null);
  const [courtId, setCourtId] = useState<number | null>(null);
  const [rangeFrom, setRangeFrom] = useState(() => todayYmd());
  const [rangeTo, setRangeTo] = useState(() => addMonthsYmd(todayYmd(), 2));

  const [bulkFrom, setBulkFrom] = useState(() => todayYmd());
  const [bulkTo, setBulkTo] = useState(() => addMonthsYmd(todayYmd(), 1));
  const [skipHolidays, setSkipHolidays] = useState(true);
  const [patternSlots, setPatternSlots] = useState<TimePair[]>([
    { start_time: "08:00", end_time: "09:00" },
  ]);

  const [genIntervalMin, setGenIntervalMin] = useState(30);
  const [genOpen, setGenOpen] = useState("08:00");
  const [genCloseMode, setGenCloseMode] = useState<"time" | "midnight">("midnight");
  const [genClose, setGenClose] = useState("22:00");
  const [genBreakEnabled, setGenBreakEnabled] = useState(true);
  const [genBreakStart, setGenBreakStart] = useState("17:00");
  const [genBreakEnd, setGenBreakEnd] = useState("18:00");

  const [holidayDate, setHolidayDate] = useState("");
  const [holidayLabel, setHolidayLabel] = useState("");

  const [resetDay, setResetDay] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editSlot, setEditSlot] = useState<CustomSlot | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/auth/signin");
  }, [navigate]);

  const { data: arenasData } = useQuery({
    queryKey: ["bookingSettingsArenas", scope],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/${scope}/arenas`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load arenas");
      return json.arenas as ArenaRow[];
    },
  });

  const arenas = arenasData ?? [];

  useEffect(() => {
    if (!arenaId && arenas.length > 0) {
      setArenaId(arenas[0].id);
    }
  }, [arenas, arenaId]);

  const { data: courtsData } = useQuery({
    queryKey: ["bookingSettingsCourts", scope, arenaId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE_URL}/${scope}/arenas/${arenaId}/courts`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load courts");
      return json.courts as CourtRow[];
    },
    enabled: Boolean(arenaId),
  });

  const courts = useMemo(
    () =>
      (courtsData ?? []).filter((c) => !c.is_deleted || c.is_deleted === 0),
    [courtsData],
  );

      useEffect(() => {
    if (!courtId && courts.length > 0) {
      setCourtId(courts[0].id);
    }
    if (courtId && courts.length && !courts.some((c) => c.id === courtId)) {
      setCourtId(courts[0].id);
    }
  }, [courts, courtId]);

  const { data: templateData } = useQuery({
      queryKey: ["slotTemplate", scope, courtId],
      queryFn: async () => {
        const res = await fetch(
          `${API_BASE_URL}/${scope}/courts/${courtId}/default-slot-template`,
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load template");
        return json.template as SlotTemplateRow[];
      },
      enabled: Boolean(courtId),
    });

  const { data: rangeData, isLoading: rangeLoading } = useQuery({
    queryKey: ["slotsRange", scope, courtId, rangeFrom, rangeTo],
    queryFn: async () => {
      const q = new URLSearchParams({ from: rangeFrom, to: rangeTo });
      const res = await fetch(
        `${API_BASE_URL}/${scope}/courts/${courtId}/slots-range?${q}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load schedule");
      return json as {
        customSlots: CustomSlot[];
        defaultDates: string[];
        holidays: Holiday[];
      };
    },
    enabled: Boolean(courtId),
  });

  const { data: holidaysData } = useQuery({
    queryKey: ["arenaHolidays", scope, arenaId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE_URL}/${scope}/arenas/${arenaId}/holidays`,
      );
      const json = await parseApiJson(res);
      if (!res.ok) throw new Error(String(json.error || "Failed to load holidays"));
      return (json.holidays as Holiday[]) ?? [];
    },
    enabled: Boolean(arenaId),
  });

  const computeSlotsFromBuilder = (): { slots: TimePair[]; error?: string } => {
    const openM = parseFlexibleTimeToMinutes(genOpen);
    if (openM == null) {
      return { slots: [], error: "Enter a valid opening time (HH:MM)." };
    }
    let closeM: number;
    if (genCloseMode === "midnight") {
      closeM = 24 * 60;
    } else {
      const c = parseFlexibleTimeToMinutes(genClose);
      if (c == null) {
        return { slots: [], error: "Enter a valid closing time (HH:MM)." };
      }
      if (c <= openM) {
        return { slots: [], error: "Closing time must be after opening time." };
      }
      closeM = c;
    }
    let bS: number | null = null;
    let bE: number | null = null;
    if (genBreakEnabled) {
      bS = parseFlexibleTimeToMinutes(genBreakStart);
      bE = parseFlexibleTimeToMinutes(genBreakEnd);
      if (bS == null || bE == null) {
        return { slots: [], error: "Enter valid break times (HH:MM)." };
      }
      if (bS >= bE) {
        return { slots: [], error: "Break end must be after break start." };
      }
    }
    const slots = buildSlotsFromInterval({
      intervalMinutes: genIntervalMin,
      openMinutes: openM,
      closeMinutes: closeM,
      breakStart: bS,
      breakEnd: bE,
    });
    if (slots.length === 0) {
      return {
        slots: [],
        error:
          "No slots fit that schedule. Try a shorter interval, widen open hours, or shorten the break.",
      };
    }
    return { slots };
  };

  const bulkMutation = useMutation({
    mutationFn: async (overrideSlots?: TimePair[]) => {
      const list =
        overrideSlots ?? patternSlots.filter((s) => s.start_time && s.end_time);
      const res = await fetch(
        `${API_BASE_URL}/${scope}/courts/${courtId}/slots/bulk-apply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from_date: bulkFrom,
            to_date: bulkTo,
            slots: list,
            skip_holidays: skipHolidays,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || "Apply failed");
      return json;
    },
    onSuccess: (data, variables) => {
      toast.success(data.message || "Slots applied");
      if (variables && variables.length > 0) {
        setPatternSlots(variables);
      }
      queryClient.invalidateQueries({ queryKey: ["slotsRange"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onFillFromBuilder = () => {
    const { slots, error } = computeSlotsFromBuilder();
    if (error) {
      toast.error(error);
      return;
    }
    setPatternSlots(slots);
    toast.success(
      `Filled the list with ${slots.length} slots. Click Apply to range when ready.`,
    );
  };

  const onGenerateAndApply = () => {
    const { slots, error } = computeSlotsFromBuilder();
    if (error) {
      toast.error(error);
      return;
    }
    bulkMutation.mutate(slots);
  };

  const addHolidayMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${API_BASE_URL}/${scope}/arenas/${arenaId}/holidays`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            holiday_date: holidayDate,
            label: holidayLabel || null,
          }),
        },
      );
      const json = await parseApiJson(res);
      if (!res.ok) throw new Error(String(json.error || "Could not save holiday"));
      return json;
    },
    onSuccess: () => {
      toast.success("Holiday saved");
      setHolidayDate("");
      setHolidayLabel("");
      queryClient.invalidateQueries({ queryKey: ["arenaHolidays"] });
      queryClient.invalidateQueries({ queryKey: ["slotsRange"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeHolidayMutation = useMutation({
    mutationFn: async (hid: number) => {
      const res = await fetch(
        `${API_BASE_URL}/${scope}/arenas/${arenaId}/holidays/${hid}`,
        { method: "DELETE" },
      );
      const json = await parseApiJson(res);
      if (!res.ok) throw new Error(String(json.error || "Delete failed"));
      return json;
    },
    onSuccess: () => {
      toast.success("Holiday removed");
      queryClient.invalidateQueries({ queryKey: ["arenaHolidays"] });
      queryClient.invalidateQueries({ queryKey: ["slotsRange"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: number) => {
      const res = await fetch(
        `${API_BASE_URL}/${scope}/custom-slots/${slotId}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Delete failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Slot removed");
      queryClient.invalidateQueries({ queryKey: ["slotsRange"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateSlotMutation = useMutation({
    mutationFn: async () => {
      if (!editSlot) return;
      const res = await fetch(
        `${API_BASE_URL}/${scope}/custom-slots/${editSlot.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_time: editStart,
            end_time: editEnd,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Slot updated");
      setEditOpen(false);
      setEditSlot(null);
      queryClient.invalidateQueries({ queryKey: ["slotsRange"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetDayMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${API_BASE_URL}/${scope}/courts/${courtId}/slots/reset-day`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: resetDay }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Reset failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Day reset to default template");
      queryClient.invalidateQueries({ queryKey: ["slotsRange"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (slot: CustomSlot) => {
    setEditSlot(slot);
    setEditStart(String(slot.start_time).slice(0, 5));
    setEditEnd(String(slot.end_time).slice(0, 5));
    setEditOpen(true);
  };

  const addPatternRow = () =>
    setPatternSlots((rows) => [...rows, { start_time: "", end_time: "" }]);
  const removePatternRow = (idx: number) =>
    setPatternSlots((rows) => rows.filter((_, i) => i !== idx));
  const setPatternRow = (idx: number, field: keyof TimePair, value: string) => {
    setPatternSlots((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const formatTime = (t: string) => String(t).slice(0, 5);

  return (
    <>
      <Breadcrumb pageName="Booking Settings" />

      <div className="mb-6 flex flex-wrap items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
        <FaLayerGroup className="mt-1 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-body-color dark:text-bodydark">
          Choose an <strong>arena</strong> and <strong>court</strong>, then set
          bookable time slots. Apply the same pattern across a <strong>date range</strong>
          , mark <strong>holidays</strong> when the whole venue is closed, and edit
          or remove individual custom slots. Days without custom rows use this court&apos;s{" "}
          <strong>default template</strong> (below).
        </p>
      </div>

      <div className="mb-6 grid gap-4 rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark md:grid-cols-2">
        <div>
          <label
            htmlFor="bs-arena"
            className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white"
          >
            <FaBuilding className="h-4 w-4 text-primary" aria-hidden />
            Arena
          </label>
          <select
            id="bs-arena"
            value={arenaId ?? ""}
            onChange={(e) => {
              setArenaId(Number(e.target.value));
              setCourtId(null);
            }}
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
          >
            {arenas.length === 0 ? (
              <option value="">No arenas</option>
            ) : (
              arenas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.city ? ` — ${a.city}` : ""} ({a.status})
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label
            htmlFor="bs-court"
            className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white"
          >
            <FaClipboardList className="h-4 w-4 text-primary" aria-hidden />
            Court
          </label>
          <select
            id="bs-court"
            value={courtId ?? ""}
            onChange={(e) => setCourtId(Number(e.target.value))}
            disabled={!arenaId || courts.length === 0}
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 disabled:opacity-50 dark:border-strokedark"
          >
            {courts.length === 0 ? (
              <option value="">Select an arena with courts</option>
            ) : (
              courts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.sport_name ? ` (${c.sport_name})` : ""}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {!courtId ? (
        <div className="text-body-color dark:text-bodydark">
          Select an arena and court to continue.
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
              <FaClock className="h-5 w-5 text-primary" aria-hidden />
              Default slot template (this court)
            </h2>
            <p className="mb-4 text-sm text-body-color dark:text-bodydark">
              When a day is not overridden, booking uses these times from{" "}
              <span className="font-mono text-xs">default_slots</span> in the database.
            </p>
            <ul className="flex flex-wrap gap-2">
              {(templateData ?? []).length === 0 ? (
                <li className="text-sm text-amber-700 dark:text-amber-400">
                  No default template rows—add rows in the database or contact an admin.
                </li>
              ) : (
                templateData!.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-meta-4"
                  >
                    {formatTime(row.start_time)} – {formatTime(row.end_time)}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="mb-6 rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
              <FaUmbrellaBeach className="h-5 w-5 text-primary" aria-hidden />
              Arena holidays (closed days)
            </h2>
            <p className="mb-4 text-sm text-body-color dark:text-bodydark">
              On these dates, <strong>all courts</strong> in this arena show no bookable
              slots to customers. Apply-slot range can optionally skip them.
            </p>

            <div className="mb-4 flex flex-wrap gap-3">
              <input
                type="date"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
              />
              <input
                type="text"
                placeholder="Label e.g. Eid, New Year"
                value={holidayLabel}
                onChange={(e) => setHolidayLabel(e.target.value)}
                className="min-w-[200px] flex-1 rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
              />
              <button
                type="button"
                disabled={!holidayDate || !arenaId || addHolidayMutation.isPending}
                onClick={() => addHolidayMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <FaPlus className="h-3.5 w-3.5" />
                Add holiday
              </button>
            </div>

            <ul className="divide-y divide-stroke dark:divide-strokedark">
              {(holidaysData ?? []).length === 0 ? (
                <li className="py-3 text-sm text-body-color dark:text-bodydark">
                  No holidays yet. Run DB migration{" "}
                  <code className="rounded bg-gray-100 px-1 text-xs dark:bg-meta-4">
                    005_arena_holidays.sql
                  </code>{" "}
                  if adding holidays fails.
                </li>
              ) : (
                holidaysData!.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <FaCalendarAlt className="h-4 w-4 text-body-color" />
                      <strong>
                        {format(parseISO(h.holiday_date), "MMM d, yyyy")}
                      </strong>
                      {h.label ? (
                        <span className="text-body-color">— {h.label}</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeHolidayMutation.mutate(h.id)}
                      className="inline-flex items-center gap-1 text-sm text-rose-600 hover:underline"
                    >
                      <FaTrash className="h-3 w-3" />
                      Remove
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="mb-6 rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
              <FaLayerGroup className="h-5 w-5 text-primary" aria-hidden />
              Apply custom slots to a date range
            </h2>
            <p className="mb-4 text-sm text-body-color dark:text-bodydark">
              For each day in the range (except skipped holidays), this{" "}
              <strong>replaces</strong> that day&apos;s custom slots with the pattern
              below and marks the day as using custom scheduling (not the default template).
            </p>

            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">From</label>
                <input
                  type="date"
                  value={bulkFrom}
                  onChange={(e) => setBulkFrom(e.target.value)}
                  className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">To</label>
                <input
                  type="date"
                  value={bulkTo}
                  onChange={(e) => setBulkTo(e.target.value)}
                  className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                />
              </div>
            </div>

            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={skipHolidays}
                onChange={(e) => setSkipHolidays(e.target.checked)}
                className="rounded border-stroke"
              />
              Skip dates that are arena holidays
            </label>

            <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
              <h3 className="mb-2 flex items-center gap-2 text-base font-semibold text-black dark:text-white">
                <FaMagic className="h-4 w-4 text-primary" aria-hidden />
                Quick slot builder
              </h3>
              <p className="mb-4 text-sm text-body-color dark:text-bodydark">
                Set slot length, day open/close, and an optional break. We skip any
                slot that overlaps the break (e.g. 5:00–6:00 PM). Choose{" "}
                <strong>Until midnight</strong> for the last slot to end at{" "}
                <span className="font-mono text-xs">24:00</span> (end of day).
              </p>

              <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                    <FaStopwatch className="h-3.5 w-3.5 text-primary" aria-hidden />
                    Slot length (minutes)
                  </label>
                  <select
                    value={genIntervalMin}
                    onChange={(e) => setGenIntervalMin(Number(e.target.value))}
                    className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 dark:border-strokedark"
                  >
                    {[15, 20, 30, 45, 60, 90, 120].map((n) => (
                      <option key={n} value={n}>
                        {n} min
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                    <FaClock className="h-3.5 w-3.5 text-primary" aria-hidden />
                    Opens
                  </label>
                  <input
                    type="time"
                    value={genOpen}
                    onChange={(e) => setGenOpen(e.target.value)}
                    className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium">Closes</label>
                  <div className="mb-2 flex flex-wrap gap-4">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="bs-gen-close"
                        checked={genCloseMode === "time"}
                        onChange={() => setGenCloseMode("time")}
                        className="rounded border-stroke"
                      />
                      At time
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="bs-gen-close"
                        checked={genCloseMode === "midnight"}
                        onChange={() => setGenCloseMode("midnight")}
                        className="rounded border-stroke"
                      />
                      Until midnight (24:00)
                    </label>
                  </div>
                  {genCloseMode === "time" ? (
                    <input
                      type="time"
                      value={genClose}
                      onChange={(e) => setGenClose(e.target.value)}
                      className="w-full max-w-[12rem] rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                    />
                  ) : (
                    <p className="text-xs text-body-color dark:text-bodydark">
                      Last bookable block ends at 24:00 (e.g. 23:30–24:00 for 30-minute
                      slots).
                    </p>
                  )}
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-stroke/80 p-3 dark:border-strokedark">
                <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={genBreakEnabled}
                    onChange={(e) => setGenBreakEnabled(e.target.checked)}
                    className="rounded border-stroke"
                  />
                  <FaCoffee className="h-4 w-4 text-amber-600" aria-hidden />
                  Break (no bookings during this window)
                </label>
                {genBreakEnabled ? (
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="mb-1 block text-xs">From</label>
                      <input
                        type="time"
                        value={genBreakStart}
                        onChange={(e) => setGenBreakStart(e.target.value)}
                        className="rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs">To</label>
                      <input
                        type="time"
                        value={genBreakEnd}
                        onChange={(e) => setGenBreakEnd(e.target.value)}
                        className="rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onFillFromBuilder}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary bg-white px-4 py-2 text-sm font-medium text-primary dark:bg-boxdark"
                >
                  <FaMagic className="h-3.5 w-3.5" />
                  Fill slot list
                </button>
                <button
                  type="button"
                  disabled={bulkMutation.isPending}
                  onClick={onGenerateAndApply}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  <FaSyncAlt
                    className={
                      bulkMutation.isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"
                    }
                  />
                  Generate &amp; apply to range
                </button>
              </div>
            </div>

            <p className="mb-2 text-xs font-medium text-body-color dark:text-bodydark">
              Slot pattern (manual rows or filled from builder)
            </p>
            <p className="mb-3 text-xs text-body-color dark:text-bodydark">
              Use <span className="font-mono">HH:MM</span> (24-hour). The builder may use{" "}
              <span className="font-mono">24:00</span> as the end of the last slot when closing
              is &quot;Until midnight&quot;.
            </p>

            <div className="mb-4 space-y-3">
              {patternSlots.map((row, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs">Start</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="08:00"
                      value={row.start_time}
                      onChange={(e) =>
                        setPatternRow(idx, "start_time", e.target.value)
                      }
                      className="w-[6.75rem] rounded-lg border border-stroke px-3 py-2 font-mono text-sm dark:border-strokedark"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs">End</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="08:30"
                      value={row.end_time}
                      onChange={(e) =>
                        setPatternRow(idx, "end_time", e.target.value)
                      }
                      className="w-[6.75rem] rounded-lg border border-stroke px-3 py-2 font-mono text-sm dark:border-strokedark"
                    />
                  </div>
                  {patternSlots.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removePatternRow(idx)}
                      className="rounded-lg border border-stroke px-3 py-2 text-rose-600 dark:border-strokedark"
                    >
                      <FaTrash className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={addPatternRow}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary"
              >
                <FaPlus className="h-3.5 w-3.5" />
                Add time row
              </button>
            </div>

            <button
              type="button"
              disabled={bulkMutation.isPending}
              onClick={() => bulkMutation.mutate(undefined)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              <FaSyncAlt className={bulkMutation.isPending ? "animate-spin" : ""} />
              Apply to range
            </button>
          </div>

          <div className="mb-6 rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                <FaCalendarAlt className="h-5 w-5 text-primary" aria-hidden />
                Schedule in range
              </h2>
              <button
                type="button"
                onClick={() =>
                  queryClient.invalidateQueries({ queryKey: ["slotsRange"] })
                }
                className="inline-flex items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark"
              >
                <FaSyncAlt className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>

            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Show from</label>
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Show to</label>
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                />
              </div>
            </div>

            {rangeLoading ? (
              <p className="text-sm text-body-color">Loading…</p>
            ) : rangeData ? (
              <>
                {rangeData.holidays.length > 0 ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="text-xs font-medium text-body-color">
                      Holidays in view:
                    </span>
                    {rangeData.holidays.map((h) => (
                      <span
                        key={h.id}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs dark:bg-amber-900/40"
                      >
                        <FaUmbrellaBeach className="h-3 w-3" />
                        {format(parseISO(h.holiday_date), "MMM d")}
                        {h.label ? ` — ${h.label}` : ""}
                      </span>
                    ))}
                  </div>
                ) : null}

                {rangeData.defaultDates.length > 0 ? (
                  <p className="mb-3 text-xs text-body-color dark:text-bodydark">
                    <FaUndo className="mr-1 inline h-3 w-3" />
                    {rangeData.defaultDates.length} day(s) use the{" "}
                    <strong>default template</strong> (no custom rows):{" "}
                    {rangeData.defaultDates.slice(0, 8).join(", ")}
                    {rangeData.defaultDates.length > 8
                      ? `… +${rangeData.defaultDates.length - 8} more`
                      : ""}
                  </p>
                ) : null}

                <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-stroke p-4 dark:border-strokedark">
                  <div>
                    <label className="mb-1 block text-xs">Reset one day to default</label>
                    <input
                      type="date"
                      value={resetDay}
                      onChange={(e) => setResetDay(e.target.value)}
                      className="rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!resetDay || resetDayMutation.isPending}
                    onClick={() => resetDayMutation.mutate()}
                    className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary disabled:opacity-50"
                  >
                    <FaUndo className="h-3.5 w-3.5" />
                    Reset day
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-stroke dark:border-strokedark">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Start</th>
                        <th className="px-3 py-2">End</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rangeData.customSlots.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-3 py-6 text-center text-body-color"
                          >
                            No custom slot rows in this range. Days without custom rows use
                            the default template unless they are holidays.
                          </td>
                        </tr>
                      ) : (
                        rangeData.customSlots.map((s) => (
                          <tr
                            key={s.id}
                            className={`border-b border-stroke dark:border-strokedark ${
                              s.is_arena_holiday
                                ? "bg-amber-50/90 dark:bg-amber-950/25"
                                : ""
                            }`}
                          >
                            <td className="px-3 py-2">
                              {format(parseISO(String(s.slot_date).slice(0, 10)), "EEE, MMM d yyyy")}
                              {s.is_arena_holiday ? (
                                <span className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                                  <FaUmbrellaBeach className="h-3 w-3 shrink-0" />
                                  Arena holiday — customers cannot book this day
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 font-mono">{formatTime(s.start_time)}</td>
                            <td className="px-3 py-2 font-mono">{formatTime(s.end_time)}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => openEdit(s)}
                                className="mr-2 inline-flex items-center gap-1 text-primary"
                              >
                                <FaEdit className="h-3.5 w-3.5" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Delete this slot row?",
                                    )
                                  )
                                    deleteSlotMutation.mutate(s.id);
                                }}
                                className="inline-flex items-center gap-1 text-rose-600"
                              >
                                <FaTrash className="h-3.5 w-3.5" />
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>
        </>
      )}

      {editOpen && editSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-stroke bg-white p-6 shadow-lg dark:border-strokedark dark:bg-boxdark">
            <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">
              Edit slot
            </h3>
            <p className="mb-4 text-sm text-body-color">
              {format(parseISO(editSlot.slot_date), "MMM d, yyyy")}
            </p>
            <div className="mb-4 flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs">Start</label>
                <input
                  type="time"
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                  className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs">End</label>
                <input
                  type="time"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setEditSlot(null);
                }}
                className="rounded-lg border border-stroke px-4 py-2 text-sm dark:border-strokedark"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateSlotMutation.isPending}
                onClick={() => updateSlotMutation.mutate()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default BookingSettings;
