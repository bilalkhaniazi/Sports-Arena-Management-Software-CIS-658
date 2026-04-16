import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { getStoredUser } from "../../utils/auth";

type Booking = {
  id: number;
  court_id: number;
  name: string;
  phone: string;
  email: string;
  start_time: string;
  end_time: string;
  booking_date: string;
  online_price: number;
  cash_price: number;
  add_on: string;
  add_on_price: number;
  court_name?: string | null;
  arena_name?: string | null;
  arena_city?: string | null;
  cancellation_pending_status?: string | null;
  cancellation_last_denial_note?: string | null;
};

type BookingLookupResponse = {
  bookings: Booking[];
};

const formatTime = (value: string) => value.slice(0, 5).replace(/^24:/, "00:");

const BookingsPage = () => {
  const storedUser = getStoredUser();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [cancelNotes, setCancelNotes] = useState<Record<number, string>>({});
  const queryClient = useQueryClient();

  const lookupQuery = useQuery<BookingLookupResponse, Error>({
    queryKey: ["customerBookings", storedUser?.email, search, fromDate, toDate],
    queryFn: async () => {
      const query = new URLSearchParams();
      query.set("email", storedUser?.email || "");

      if (search) query.set("search", search);
      if (fromDate) query.set("fromDate", fromDate);
      if (toDate) query.set("toDate", toDate);

      const response = await fetch(
        `http://localhost:5000/api/customer/bookings?${query.toString()}`,
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch bookings");
      }

      return data;
    },
    enabled: Boolean(storedUser?.email),
  });

  const requestCancellationMutation = useMutation({
    mutationFn: async ({ bookingId, note }: { bookingId: number; note: string }) => {
      const response = await fetch(
        `http://localhost:5000/api/customer/bookings/${bookingId}/cancellation-request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: storedUser?.email,
            note: note.trim() || undefined,
          }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not submit cancellation request");
      }

      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(
        "Cancellation request sent. The venue will email you or update the booking when it is reviewed.",
      );
      setCancelNotes((prev) => ({ ...prev, [variables.bookingId]: "" }));
      queryClient.invalidateQueries({ queryKey: ["customerBookings"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const filteredSummary = useMemo(() => {
    const bookings = lookupQuery.data?.bookings ?? [];
    const total = bookings.length;
    const upcoming = bookings.filter(
      (booking) => booking.booking_date >= new Date().toISOString().split("T")[0],
    ).length;
    return { total, upcoming };
  }, [lookupQuery.data?.bookings]);

  const handleFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    lookupQuery.refetch();
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-black dark:text-white">
          My Bookings
        </h1>
        <p className="text-body-color dark:text-bodydark">
          View bookings for {storedUser?.email || "your account"}. To change or cancel, contact
          the venue or submit a cancellation request below.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="text-sm text-body-color dark:text-bodydark">Total Bookings</div>
          <div className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {filteredSummary.total}
          </div>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="text-sm text-body-color dark:text-bodydark">Upcoming</div>
          <div className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {filteredSummary.upcoming}
          </div>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="text-sm text-body-color dark:text-bodydark">Customer Account</div>
          <div className="mt-2 text-sm font-medium text-black dark:text-white">
            {storedUser?.name || storedUser?.email || "Signed in user"}
          </div>
        </div>
      </div>

      <form
        onSubmit={handleFilterSubmit}
        className="mb-8 grid gap-4 rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark md:grid-cols-[1.5fr_1fr_1fr_auto]"
      >
        <input
          type="text"
          placeholder="Search by arena, court, add-on, or booking name"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
        />
        <input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
        />
        <input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-5 py-3 font-medium text-white"
        >
          Apply Filters
        </button>
      </form>

      {lookupQuery.isLoading ? <div>Loading bookings...</div> : null}
      {lookupQuery.isError ? (
        <div className="mb-6 text-red-500">Error: {lookupQuery.error.message}</div>
      ) : null}

      {!lookupQuery.isLoading && !lookupQuery.data?.bookings.length ? (
        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          No bookings matched your current filters.
        </div>
      ) : null}

      <div className="grid gap-4">
        {lookupQuery.data?.bookings.map((booking) => {
          const pending = booking.cancellation_pending_status === "pending";
          const denialNote = booking.cancellation_last_denial_note;

          return (
            <div
              key={booking.id}
              className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-black dark:text-white">
                    Booking #{booking.id}
                  </h2>
                  <p className="text-sm text-body-color dark:text-bodydark">
                    {booking.booking_date} | {formatTime(booking.start_time)} -{" "}
                    {formatTime(booking.end_time)}
                  </p>
                  <p className="text-sm font-medium text-primary">
                    {booking.arena_name || "Cross Courts Arena"}
                    {booking.arena_city ? ` · ${booking.arena_city}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {booking.court_name || `Court ${booking.court_id}`}
                  </span>
                  {pending ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                      Cancellation pending review
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2 text-sm text-body-color dark:text-bodydark md:grid-cols-2">
                <p>Name: {booking.name}</p>
                <p>Email: {booking.email}</p>
                <p>Phone: {booking.phone}</p>
                <p>Online price: USD ${booking.online_price}</p>
                <p>Cash price: USD ${booking.cash_price}</p>
                <p>
                  Add-on: {booking.add_on || "None"}{" "}
                  {booking.add_on_price ? `(USD $${booking.add_on_price})` : ""}
                </p>
              </div>

              {denialNote && !pending ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  Your last cancellation request was denied: {denialNote}
                </p>
              ) : null}

              <div className="mt-4 space-y-3 border-t border-stroke pt-4 dark:border-strokedark">
                <p className="text-xs text-body-color dark:text-bodydark">
                  Bookings cannot be edited here. To cancel, request a cancellation; staff will
                  approve or deny based on venue policy.
                </p>
                <label className="block text-xs font-medium text-black dark:text-white">
                  Optional message to the venue
                  <textarea
                    value={cancelNotes[booking.id] ?? ""}
                    onChange={(event) =>
                      setCancelNotes((prev) => ({
                        ...prev,
                        [booking.id]: event.target.value,
                      }))
                    }
                    disabled={pending || requestCancellationMutation.isPending}
                    rows={2}
                    placeholder="e.g. reason for cancelling"
                    className="mt-1 w-full max-w-lg rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm dark:border-strokedark"
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    pending ||
                    requestCancellationMutation.isPending ||
                    !storedUser?.email
                  }
                  onClick={() =>
                    requestCancellationMutation.mutate({
                      bookingId: booking.id,
                      note: cancelNotes[booking.id] ?? "",
                    })
                  }
                  className="rounded-lg border border-amber-600 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  {pending
                    ? "Cancellation requested"
                    : requestCancellationMutation.isPending
                      ? "Submitting…"
                      : "Request cancellation"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookingsPage;
