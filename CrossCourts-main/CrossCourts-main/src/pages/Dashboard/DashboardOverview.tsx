import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import CardDataStats from "../../components/CardDataStats";
import ChartOne from "../../components/Charts/ChartOne";
import TableOne from "../../components/Tables/TableOne";

type TotalBookingsResponse = { totalBookings: number };
type TotalPriceResponse = { totalPrice: number };
type UniqueUsersResponse = { totalUsers: number };
type TotalCourtsResponse = { totalCourts: number };
type TotalArenasResponse = { totalArenas: number };

type ArenaRow = { id: number; name: string; city: string | null };
type CourtRow = { id: number; name: string; arena_id?: number | null };

const getBackofficeScope = () =>
  window.location.pathname.startsWith("/admin") ? "admin" : "operator";

const API = "http://localhost:5000/api";

function buildReportUrl(
  scope: string,
  path: string,
  arenaId: string,
  courtId: string,
  includeArenaInTotalArenas = false,
): string {
  const p = new URLSearchParams();
  if (arenaId !== "all") p.set("arena_id", arenaId);
  if (courtId !== "all") p.set("court_id", courtId);
  const qs = p.toString();
  return `${API}/${scope}/reports/${path}${qs ? `?${qs}` : ""}`;
}

const fetchArenas = async (scope: string): Promise<ArenaRow[]> => {
  const res = await fetch(`${API}/${scope}/arenas`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to fetch arenas");
  return json.arenas as ArenaRow[];
};

const fetchCourtsAll = async (scope: string): Promise<CourtRow[]> => {
  const res = await fetch(`${API}/${scope}/courts`);
  const json = await res.json();
  if (!res.ok) throw new Error("Failed to fetch courts");
  if (Array.isArray(json)) return json;
  if (json?.courts) return json.courts;
  return [];
};

const fetchCourtsForArena = async (
  scope: string,
  arenaId: string,
): Promise<CourtRow[]> => {
  const res = await fetch(`${API}/${scope}/arenas/${arenaId}/courts`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to fetch courts");
  return json.courts ?? [];
};

const DashboardOverview: React.FC = () => {
  const navigate = useNavigate();
  const scope = getBackofficeScope();
  const basePath = scope === "admin" ? "/admin" : "/operator";

  const [filterArena, setFilterArena] = useState("all");
  const [filterCourt, setFilterCourt] = useState("all");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/auth/signin");
    }
  }, [navigate]);

  const { data: arenas = [] } = useQuery({
    queryKey: ["dashArenas", scope],
    queryFn: () => fetchArenas(scope),
  });

  const { data: allCourts = [] } = useQuery({
    queryKey: ["dashCourtsAll", scope],
    queryFn: () => fetchCourtsAll(scope),
  });

  const { data: arenaCourts = [] } = useQuery({
    queryKey: ["dashCourtsArena", scope, filterArena],
    queryFn: () => fetchCourtsForArena(scope, filterArena),
    enabled: filterArena !== "all",
  });

  const courtsForSelect =
    filterArena === "all" ? allCourts : arenaCourts;

  useEffect(() => {
    if (filterCourt === "all") return;
    const ok = courtsForSelect.some((c) => String(c.id) === filterCourt);
    if (!ok) setFilterCourt("all");
  }, [courtsForSelect, filterCourt]);

  const filterKey = [filterArena, filterCourt] as const;

  const { data: bookingsData, isLoading: loadingBookings, isError: errBookings } =
    useQuery<TotalBookingsResponse>({
      queryKey: ["totalBookings", scope, ...filterKey],
      queryFn: async () => {
        const res = await fetch(
          buildReportUrl(scope, "summary/total-bookings", filterArena, filterCourt),
        );
        if (!res.ok) throw new Error("Failed to fetch total bookings.");
        return res.json();
      },
    });

  const { data: priceData, isLoading: loadingPrice, isError: errPrice } =
    useQuery<TotalPriceResponse>({
      queryKey: ["totalPrice", scope, ...filterKey],
      queryFn: async () => {
        const res = await fetch(
          buildReportUrl(scope, "summary/total-price", filterArena, filterCourt),
        );
        if (!res.ok) throw new Error("Failed to fetch total price.");
        return res.json();
      },
    });

  const { data: usersData, isLoading: loadingUsers, isError: errUsers } =
    useQuery<UniqueUsersResponse>({
      queryKey: ["uniqueUsers", scope, ...filterKey],
      queryFn: async () => {
        const res = await fetch(
          buildReportUrl(scope, "summary/unique-users", filterArena, filterCourt),
        );
        if (!res.ok) throw new Error("Failed to fetch unique users.");
        return res.json();
      },
    });

  const { data: courtsData, isLoading: loadingCourts, isError: errCourts } =
    useQuery<TotalCourtsResponse>({
      queryKey: ["totalCourts", scope, filterArena, filterCourt],
      queryFn: async () => {
        const res = await fetch(
          buildReportUrl(scope, "summary/total-courts", filterArena, filterCourt),
        );
        if (!res.ok) throw new Error("Failed to fetch total courts.");
        return res.json();
      },
    });

  const { data: arenasCountData, isLoading: loadingArenas, isError: errArenas } =
    useQuery<TotalArenasResponse>({
      queryKey: ["totalArenas", scope],
      queryFn: async () => {
        const res = await fetch(`${API}/${scope}/reports/summary/total-arenas`);
        if (!res.ok) throw new Error("Failed to fetch total arenas.");
        return res.json();
      },
    });

  const loading =
    loadingBookings ||
    loadingPrice ||
    loadingUsers ||
    loadingCourts ||
    loadingArenas;
  const err =
    errBookings || errPrice || errUsers || errCourts || errArenas;

  const totalBookings = bookingsData?.totalBookings ?? 0;
  const totalPrice = priceData?.totalPrice ?? 0;
  const totalUsers = usersData?.totalUsers ?? 0;
  const totalCourts = courtsData?.totalCourts ?? 0;
  const totalArenas = arenasCountData?.totalArenas ?? 0;

  const filterDescription = useMemo(() => {
    if (filterArena === "all" && filterCourt === "all") {
      return "Showing totals for all arenas and courts.";
    }
    const bits: string[] = [];
    if (filterArena !== "all") {
      const a = arenas.find((x) => String(x.id) === filterArena);
      bits.push(a ? `Arena: ${a.name}` : `Arena #${filterArena}`);
    }
    if (filterCourt !== "all") {
      const c = courtsForSelect.find((x) => String(x.id) === filterCourt);
      bits.push(c ? `Court: ${c.name}` : `Court #${filterCourt}`);
    }
    return `Filtered by ${bits.join(" · ")}.`;
  }, [filterArena, filterCourt, arenas, courtsForSelect]);

  const goBookingHistory = () =>
    navigate(scope === "admin" ? `${basePath}/bookings` : `${basePath}/booking-history`);
  const goArenaManagement = () => navigate(`${basePath}/arenas`);
  const goUniqueCustomers = () =>
    navigate(`${basePath}/booking-customers`, {
      state: { filterArena, filterCourt },
    });

  if (loading) {
    return <div>Loading stats...</div>;
  }

  if (err) {
    return <div>Error loading stats.</div>;
  }

  return (
    <>
      <h2 className="text-title-md2 mb-4 font-semibold text-black dark:text-white">
        Dashboard
      </h2>

      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-black dark:text-white">
            Filter by arena
          </label>
          <select
            value={filterArena}
            onChange={(e) => {
              setFilterArena(e.target.value);
              setFilterCourt("all");
            }}
            className="w-full rounded border border-stroke px-3 py-2 text-sm dark:border-strokedark dark:bg-boxdark dark:text-white"
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
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-medium text-black dark:text-white">
            Filter by court
          </label>
          <select
            value={filterCourt}
            onChange={(e) => setFilterCourt(e.target.value)}
            className="w-full rounded border border-stroke px-3 py-2 text-sm dark:border-strokedark dark:bg-boxdark dark:text-white"
          >
            <option value="all">All courts</option>
            {courtsForSelect.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-body-color dark:text-bodydark sm:pb-2">{filterDescription}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <CardDataStats
          title="Total Bookings"
          total={String(totalBookings)}
          rate=""
          onClick={goBookingHistory}
        >
          <svg
            className="fill-primary dark:fill-white"
            width="22"
            height="22"
            viewBox="0 0 24 24"
          >
            <path d="M5 3h14a2 2 0 0 1 2 2v2h-2V5H5v14h14v-2h2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm4 4h6v2H9V7zm-2 4h10v2H7v-2z" />
          </svg>
        </CardDataStats>

        <CardDataStats
          title="Total Revenue"
          total={`$${Number(totalPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          rate=""
          onClick={goBookingHistory}
        >
          <svg
            className="fill-primary dark:fill-white"
            width="22"
            height="22"
            viewBox="0 0 24 24"
          >
            <path d="M11 2C6.58 2 3 5.58 3 10c0 3.53 2.61 6.77 6.05 7.58v1.42h2v-1.42c1.78-.34 3.34-1.25 4.45-2.58h2.79v-2h-2.08a7.977 7.977 0 0 0 .29-2c0-4.42-3.58-8-8-8zm3.99 8c0 .68-.13 1.34-.38 1.94l-1.55-.31c.16-.5.24-1.02.24-1.63H15zM6.31 8c.38-1.72 1.89-3 3.69-3 1.65 0 3.06 1.09 3.57 2.57l-1.55.31C11.84 7.22 11.43 7 11 7 9.9 7 9 7.9 9 9c0 .43.22.84.57 1.09l-1.55.31C7.4 10.06 7 9.65 7 9.2 7 8.75 7.23 8.38 7.57 8.15L6.31 8z" />
          </svg>
        </CardDataStats>

        <CardDataStats
          title="Unique Users"
          total={String(totalUsers)}
          rate=""
          onClick={goUniqueCustomers}
        >
          <svg
            className="fill-primary dark:fill-white"
            width="22"
            height="22"
            viewBox="0 0 24 24"
          >
            <path d="M12 2c2.75 0 5 2.25 5 5s-2.25 5-5 5-5-2.25-5-5 2.25-5 5-5zm0 14c3.086 0 7 1.462 7 2.998V21H5v-2.002C5 17.462 8.914 16 12 16z" />
          </svg>
        </CardDataStats>

        <CardDataStats
          title="Total Courts"
          total={String(totalCourts)}
          rate=""
          onClick={goArenaManagement}
        >
          <svg
            className="fill-primary dark:fill-white"
            width="22"
            height="22"
            viewBox="0 0 24 24"
          >
            <path d="M3 21V8l9-6 9 6v13h-7v-7H10v7H3zM9 10h6V6.699L12 4.8l-3 1.899V10z" />
          </svg>
        </CardDataStats>

        <CardDataStats
          title="Total Arenas"
          total={String(totalArenas)}
          rate=""
          onClick={goArenaManagement}
        >
          <svg
            className="fill-primary dark:fill-white"
            width="22"
            height="22"
            viewBox="0 0 24 24"
          >
            <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5zm0 18.5c-4.28-1.15-7-5.06-7-9.5V8.3l7-3.89 7 3.89v2.7c0 4.44-2.72 8.35-7 9.5z" />
          </svg>
        </CardDataStats>
      </div>

      <div className="mt-4 grid grid-cols-12 gap-4 md:mt-4">
        <div className="col-span-12 h-full md:col-span-6">
          <ChartOne filterArena={filterArena} filterCourt={filterCourt} />
        </div>
        <div className="col-span-12 h-full md:col-span-6">
          <TableOne filterArena={filterArena} filterCourt={filterCourt} />
        </div>
      </div>
    </>
  );
};

export default DashboardOverview;
