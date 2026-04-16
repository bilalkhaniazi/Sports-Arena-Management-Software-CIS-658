import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

type Booking = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  price: number;
  booking_date: string;
  court_name: string;
  court_deleted: number;
};

const getBackofficeScope = () =>
  window.location.pathname.startsWith("/admin") ? "admin" : "operator";

function buildRecentUrl(arenaId: string, courtId: string): string {
  const scope = getBackofficeScope();
  const p = new URLSearchParams();
  if (arenaId !== "all") p.set("arena_id", arenaId);
  if (courtId !== "all") p.set("court_id", courtId);
  const qs = p.toString();
  return `http://localhost:5000/api/${scope}/reports/recent-bookings${qs ? `?${qs}` : ""}`;
}

type TableOneProps = {
  filterArena?: string;
  filterCourt?: string;
};

const TableOne: React.FC<TableOneProps> = ({
  filterArena = "all",
  filterCourt = "all",
}) => {
  const navigate = useNavigate();
  const scope = getBackofficeScope();
  const bookingHistoryPath =
    scope === "admin" ? "/admin/bookings" : "/operator/booking-history";

  const {
    data: bookings = [],
    isLoading,
    isError,
    error,
  } = useQuery<Booking[], Error>({
    queryKey: ["lastTenBookings", filterArena, filterCourt],
    queryFn: async () => {
      const res = await fetch(buildRecentUrl(filterArena, filterCourt));
      if (!res.ok) {
        throw new Error("Failed to fetch last 10 bookings");
      }
      return res.json();
    },
  });

  if (isLoading) {
    return <div className="p-4 text-center">Loading last 10 bookings...</div>;
  }

  if (isError) {
    return (
      <div className="p-4 text-center text-red-500">
        Error: {error?.message}
      </div>
    );
  }

  const priceFmt = (n: number) =>
    Number(n).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="rounded-sm h-full border border-stroke bg-white px-5 pt-6 pb-2.5 shadow-default dark:border-strokedark dark:bg-boxdark sm:px-7.5">
      <button
        type="button"
        onClick={() => navigate(bookingHistoryPath)}
        className="group mb-4 w-full text-left"
      >
        <h4 className="text-xl font-semibold text-black underline-offset-2 group-hover:underline dark:text-white">
          LAST 10 BOOKINGS
        </h4>
        <p className="text-xs text-body-color dark:text-bodydark">
          Click to open full booking history — totals match history (incl. add-ons)
        </p>
      </button>

      <div className="relative overflow-x-auto rounded-lg shadow">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-4 py-3">
                Name
              </th>
              <th scope="col" className="px-4 py-3">
                Court
              </th>
              <th scope="col" className="px-4 py-3">
                Start Time
              </th>
              <th scope="col" className="px-4 py-3">
                Total
              </th>
              <th scope="col" className="px-4 py-3">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {bookings.length > 0 ? (
              bookings.map((booking) => {
                const bookingDate = format(
                  new Date(booking.booking_date),
                  "MMM d, yyyy",
                );

                return (
                  <tr
                    key={booking.id}
                    className="bg-white border-b dark:bg-gray-800 dark:border-gray-700"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                      {booking.name}
                    </td>
                    <td className="px-4 py-3">
                      {booking.court_name}
                      {booking.court_deleted ? " (deleted)" : ""}
                    </td>
                    <td className="px-4 py-3">{String(booking.start_time).slice(0, 8)}</td>
                    <td className="px-4 py-3 tabular-nums">${priceFmt(booking.price)}</td>
                    <td className="px-4 py-3">{bookingDate}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-center">
                  No bookings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableOne;
