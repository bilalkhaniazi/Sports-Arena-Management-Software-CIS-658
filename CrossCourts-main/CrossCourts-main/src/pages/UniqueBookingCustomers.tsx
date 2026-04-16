import React, { useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Breadcrumb from "../components/Breadcrumbs/Breadcrumb";

const API = "http://localhost:5000/api";

const getBackofficeScope = () =>
  window.location.pathname.startsWith("/admin") ? "admin" : "operator";

type Row = { email: string; name: string; booking_count: number };

function buildCustomersUrl(scope: string, arenaId: string, courtId: string) {
  const p = new URLSearchParams();
  if (arenaId !== "all") p.set("arena_id", arenaId);
  if (courtId !== "all") p.set("court_id", courtId);
  const qs = p.toString();
  return `${API}/${scope}/reports/unique-booking-customers${qs ? `?${qs}` : ""}`;
}

const UniqueBookingCustomers: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const scope = getBackofficeScope();
  const basePath = scope === "admin" ? "/admin" : "/operator";

  const arenaId =
    (location.state as { filterArena?: string } | null)?.filterArena ?? "all";
  const courtId =
    (location.state as { filterCourt?: string } | null)?.filterCourt ?? "all";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/auth/signin");
  }, [navigate]);

  const { data = [], isLoading, isError } = useQuery<Row[]>({
    queryKey: ["uniqueBookingCustomers", scope, arenaId, courtId],
    queryFn: async () => {
      const res = await fetch(buildCustomersUrl(scope, arenaId, courtId));
      if (!res.ok) throw new Error("Failed to load customers");
      return res.json();
    },
  });

  const filterHint = useMemo(() => {
    if (arenaId === "all" && courtId === "all") return "All arenas and courts";
    const parts: string[] = [];
    if (arenaId !== "all") parts.push(`arena #${arenaId}`);
    if (courtId !== "all") parts.push(`court #${courtId}`);
    return parts.join(", ");
  }, [arenaId, courtId]);

  return (
    <>
      <Breadcrumb pageName="Customers (from bookings)" />
      <div className="mb-4 rounded-lg border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark">
        <p className="text-sm text-body-color dark:text-bodydark">
          Distinct customer emails from bookings
          {filterHint ? (
            <span className="ml-2 font-medium text-black dark:text-white">
              — filter: {filterHint}
            </span>
          ) : null}
          . Use the dashboard filters to narrow this list, then open Unique Users again.
        </p>
        <button
          type="button"
          onClick={() => navigate(`${basePath}`)}
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          Back to dashboard
        </button>
      </div>

      {isLoading ? (
        <p className="p-4">Loading…</p>
      ) : isError ? (
        <p className="p-4 text-red-600">Could not load customers.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">Bookings</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-body-color">
                    No customers found for this filter.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={row.email}
                    className="border-b border-stroke dark:border-strokedark"
                  >
                    <td className="px-4 py-3 font-medium text-black dark:text-white">
                      {row.name}
                    </td>
                    <td className="px-4 py-3">{row.email}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.booking_count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default UniqueBookingCustomers;
