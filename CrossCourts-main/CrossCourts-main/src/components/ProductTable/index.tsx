import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FaSearch, FaTrash } from "react-icons/fa";
import { MdNavigateBefore, MdNavigateNext } from "react-icons/md";
import { format } from "date-fns";
import { toast } from "react-toastify";

// ------------------ Types ------------------
type Booking = {
  id: number;
  court_id: number;
  start_time: string;
  end_time: string;
  name: string;
  phone: string;
  email: string;
  online_price: number;
  cash_price: number;
  add_on: string;
  add_on_price: number;
  payment_method?: string | null;
  total_price?: number | null;
  booking_date: string;
  created_at: string;
  court_name?: string | null;
  arena_name?: string | null;
};

type Court = {
  id: number;
  name: string;
  arena_id?: number | null;
};

type ArenaRow = {
  id: number;
  name: string;
  city: string | null;
};

function formatMoney(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

function displayTotal(booking: Booking): string {
  if (booking.total_price != null && booking.total_price !== undefined) {
    const t = Number(booking.total_price);
    if (!Number.isNaN(t)) return formatMoney(t);
  }
  const legacy =
    Number(booking.online_price || 0) + Number(booking.add_on_price || 0);
  return formatMoney(legacy);
}

function displayPaymentMethod(booking: Booking): string {
  const p = booking.payment_method;
  if (p === "online") return "Online";
  if (p === "cash") return "Cash";
  return "—";
}

const getBackofficeScope = () =>
  window.location.pathname.startsWith("/admin") ? "admin" : "operator";

const API = "http://localhost:5000/api";

type HistoryFilters = {
  arenaId: string;
  courtId: string;
  dateFrom: string;
  dateTo: string;
  timeFrom: string;
  timeTo: string;
  q: string;
};

function buildHistoryQuery(scope: string, f: HistoryFilters): string {
  const p = new URLSearchParams();
  if (f.arenaId && f.arenaId !== "all") p.set("arena_id", f.arenaId);
  if (f.courtId && f.courtId !== "all") p.set("court_id", f.courtId);
  if (f.dateFrom.trim()) p.set("date_from", f.dateFrom.trim());
  if (f.dateTo.trim()) p.set("date_to", f.dateTo.trim());
  if (f.timeFrom.trim()) p.set("time_from", f.timeFrom.trim());
  if (f.timeTo.trim()) p.set("time_to", f.timeTo.trim());
  if (f.q.trim()) p.set("q", f.q.trim());
  const qs = p.toString();
  return `${API}/${scope}/bookings/history${qs ? `?${qs}` : ""}`;
}

const fetchBookings = async (scope: string, f: HistoryFilters): Promise<Booking[]> => {
  const res = await fetch(buildHistoryQuery(scope, f));
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      json && typeof json === "object" && json !== null && "error" in json
        ? String((json as { error?: string }).error)
        : "Failed to fetch bookings";
    throw new Error(msg);
  }
  if (Array.isArray(json)) return json as Booking[];
  return [];
};

const fetchCourts = async (scope: string): Promise<Court[]> => {
  const res = await fetch(`${API}/${scope}/courts`);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (json && typeof json === "object" && "error" in json && String((json as { error?: string }).error)) ||
        "Failed to fetch courts",
    );
  }
  if (Array.isArray(json)) return json as Court[];
  if (json && typeof json === "object" && Array.isArray((json as { courts?: Court[] }).courts)) {
    return (json as { courts: Court[] }).courts;
  }
  return [];
};

/** Courts belonging to one arena (works even when generic /courts list omits arena_id). */
const fetchCourtsForArena = async (scope: string, arenaId: string): Promise<Court[]> => {
  const res = await fetch(`${API}/${scope}/arenas/${arenaId}/courts`);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (json && typeof json === "object" && "error" in json && String((json as { error?: string }).error)) ||
        "Failed to fetch courts for arena",
    );
  }
  const list = (json as { courts?: Court[] })?.courts;
  return Array.isArray(list) ? list : [];
};

const fetchArenas = async (scope: string): Promise<ArenaRow[]> => {
  const res = await fetch(`${API}/${scope}/arenas`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to fetch arenas");
  return json.arenas as ArenaRow[];
};

function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: Record<string, string | number>[], filename: string) {
  if (rows.length === 0) {
    toast.info("Nothing to export.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(",")),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const ProductTable: React.FC = () => {
  const scope = getBackofficeScope();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [arenaId, setArenaId] = useState<string>("all");
  const [courtId, setCourtId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  const filters: HistoryFilters = useMemo(
    () => ({
      arenaId,
      courtId,
      dateFrom,
      dateTo,
      timeFrom,
      timeTo,
      q: debouncedSearch,
    }),
    [arenaId, courtId, dateFrom, dateTo, timeFrom, timeTo, debouncedSearch],
  );

  const { data: arenas = [], isError: arenasError, error: arenasErr } = useQuery({
    queryKey: ["bhArenas", scope],
    queryFn: () => fetchArenas(scope),
  });

  const { data: allCourts = [], isError: allCourtsError, error: allCourtsErr } = useQuery({
    queryKey: ["bhCourtsAll", scope],
    queryFn: () => fetchCourts(scope),
  });

  const { data: arenaCourtsList, isError: arenaCourtsError } = useQuery({
    queryKey: ["bhCourtsArena", scope, arenaId],
    queryFn: () => fetchCourtsForArena(scope, arenaId),
    enabled: arenaId !== "all" && !Number.isNaN(Number(arenaId)),
  });

  const courtsForDropdown =
    arenaId === "all" ? allCourts : (arenaCourtsList ?? []);

  useEffect(() => {
    if (courtId === "all") return;
    const exists = courtsForDropdown.some((c) => String(c.id) === courtId);
    if (!exists) setCourtId("all");
  }, [courtsForDropdown, courtId]);

  const {
    data: bookings = [],
    isLoading: isBookingsLoading,
    isError: isBookingsError,
    error: bookingsErr,
  } = useQuery<Booking[], Error>({
    queryKey: [
      "bookings",
      scope,
      arenaId,
      courtId,
      dateFrom,
      dateTo,
      timeFrom,
      timeTo,
      debouncedSearch,
    ],
    queryFn: () => fetchBookings(scope, filters),
  });

  const courtNameMap = useMemo(() => {
    const map: Record<number, string> = {};
    allCourts.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [allCourts]);

  const totalPages = Math.max(1, Math.ceil(bookings.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const displayedBookings = bookings.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    arenaId,
    courtId,
    dateFrom,
    dateTo,
    timeFrom,
    timeTo,
    debouncedSearch,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API}/${scope}/bookings/${id}/delete`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || res.statusText || "Failed to delete booking");
      }
      return json;
    },
    onSuccess: async () => {
      toast.success("Booking deleted.");
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDelete = (id: number, label: string) => {
    if (!window.confirm(`Delete booking for "${label}"? This cannot be undone.`)) return;
    deleteMutation.mutate(id);
  };

  const exportFilteredCsv = () => {
    const exportRows = bookings.map((booking) => ({
      Name: booking.name,
      Arena: booking.arena_name || "—",
      Court: booking.court_name || courtNameMap[booking.court_id] || "—",
      Date: format(new Date(booking.booking_date), "yyyy-MM-dd"),
      "Start time": String(booking.start_time).slice(0, 8),
      "End time": String(booking.end_time).slice(0, 8),
      Phone: booking.phone,
      Email: booking.email,
      "Paid via": displayPaymentMethod(booking),
      "Online price": booking.online_price,
      "Cash price": booking.cash_price,
      "Add on": booking.add_on || "",
      "Add on price": booking.add_on_price ?? "",
      Total: displayTotal(booking),
    }));
    downloadCsv(exportRows, `bookings-filtered-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`);
  };

  const resetFilters = () => {
    setArenaId("all");
    setCourtId("all");
    setDateFrom("");
    setDateTo("");
    setTimeFrom("");
    setTimeTo("");
    setSearchTerm("");
    setDebouncedSearch("");
  };

  if (isBookingsError) {
    return (
      <div className="p-4 text-center text-red-600">
        Error loading bookings: {bookingsErr?.message || "Unknown error"}
      </div>
    );
  }

  return (
    <div className="dark:bg-boxdark-2 border-2 dark:border-boxdark dark:text-bodydark rounded-lg p-4 shadow-md sm:p-6">
      <div className="mb-4 flex flex-col gap-3">
        {(arenasError || allCourtsError) && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {[
              arenasError && `Arenas: ${(arenasErr as Error)?.message || "failed to load"}`,
              allCourtsError && `Courts: ${(allCourtsErr as Error)?.message || "failed to load"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
        {arenaId !== "all" && arenaCourtsError && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            Could not load courts for this arena; showing all courts in the list below.
          </div>
        )}
        <h2 className="text-lg font-semibold text-black dark:text-white">Filters</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Arena
            </label>
            <select
              value={arenaId}
              onChange={(e) => {
                setArenaId(e.target.value);
                setCourtId("all");
              }}
              className="w-full rounded-md border p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="all">All arenas</option>
              {arenas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.city ? ` — ${a.city}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Court
            </label>
            <select
              value={courtId}
              onChange={(e) => setCourtId(e.target.value)}
              className="w-full rounded-md border p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="all">All courts</option>
              {(arenaId !== "all" && arenaCourtsError ? allCourts : courtsForDropdown).map((court) => (
                <option key={court.id} value={court.id}>
                  {court.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Booking date from
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-md border p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Booking date to
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-md border p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Slot starts from (time)
            </label>
            <input
              type="time"
              value={timeFrom}
              onChange={(e) => setTimeFrom(e.target.value)}
              className="w-full rounded-md border p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Slot starts until (time)
            </label>
            <input
              type="time"
              value={timeTo}
              onChange={(e) => setTimeTo(e.target.value)}
              className="w-full rounded-md border p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="relative min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Search (name, phone, email, add-on)
            </label>
            <FaSearch className="pointer-events-none absolute left-3 top-[2.125rem] text-gray-500 dark:text-gray-400" />
            <input
              type="search"
              placeholder="Search…"
              className="w-full rounded-md border p-2 pl-9 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:text-white"
          >
            Clear filters
          </button>
          <button
            type="button"
            onClick={exportFilteredCsv}
            disabled={bookings.length === 0}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Download CSV (filtered)
          </button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Showing {bookings.length} booking{bookings.length === 1 ? "" : "s"} matching filters.
        </p>
      </div>

      {isBookingsLoading ? (
        <div className="p-8 text-center text-gray-600 dark:text-gray-400">Loading bookings…</div>
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-lg shadow">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Arena
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Court
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Start
                  </th>
                  <th scope="col" className="px-4 py-3">
                    End
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Phone
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Email
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Paid via
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Online
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Cash
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Add-on
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Add-on $
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Total
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedBookings.length > 0 ? (
                  displayedBookings.map((booking) => {
                    const courtName =
                      booking.court_name || courtNameMap[booking.court_id] || "—";
                    const arenaName = booking.arena_name || "—";
                    return (
                      <tr
                        key={booking.id}
                        className="border-b bg-white dark:border-gray-700 dark:bg-gray-800"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {booking.name}
                        </td>
                        <td className="px-4 py-3">{arenaName}</td>
                        <td className="px-4 py-3">{courtName}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {format(new Date(booking.booking_date), "MMM d, yyyy")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {String(booking.start_time).slice(0, 8)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {String(booking.end_time).slice(0, 8)}
                        </td>
                        <td className="px-4 py-3">{booking.phone}</td>
                        <td className="max-w-[140px] truncate px-4 py-3" title={booking.email}>
                          {booking.email}
                        </td>
                        <td className="px-4 py-3">{displayPaymentMethod(booking)}</td>
                        <td className="px-4 py-3">{booking.online_price}</td>
                        <td className="px-4 py-3">{booking.cash_price}</td>
                        <td className="max-w-[100px] truncate px-4 py-3" title={booking.add_on || ""}>
                          {booking.add_on || "—"}
                        </td>
                        <td className="px-4 py-3">{booking.add_on_price ?? "—"}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                          {displayTotal(booking)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            title="Delete booking"
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDelete(booking.id, booking.name)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            <FaTrash className="h-3 w-3" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={15} className="px-6 py-8 text-center">
                      No bookings match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {bookings.length > 0 && (
            <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
              <button
                type="button"
                className={`rounded-md p-2 ${
                  currentPage === 1
                    ? "cursor-not-allowed bg-gray-300 dark:bg-gray-700"
                    : "bg-primary text-white"
                }`}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                <MdNavigateBefore />
              </button>
              <span className="text-gray-700 dark:text-gray-400">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className={`rounded-md p-2 ${
                  currentPage === totalPages
                    ? "cursor-not-allowed bg-gray-300 dark:bg-gray-700"
                    : "bg-primary text-white"
                }`}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                <MdNavigateNext />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductTable;
