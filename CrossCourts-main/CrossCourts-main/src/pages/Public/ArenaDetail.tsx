import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { FaMapMarkerAlt } from "react-icons/fa";
import { getStoredUser } from "../../utils/auth";
import { addOneCalendarDay } from "../../utils/bookingDates";
import { getSportPresentation } from "../../utils/sportPresentation";
import HolidayDayBanner from "../../components/HolidayDayBanner";

type Arena = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  status: string;
  courtCount: number;
};

type Court = {
  id: number;
  name: string;
  cat_id: number | null;
  arena_id?: number | null;
  sport_id?: number | null;
  sport_name?: string | null;
  online_price?: number | null;
  cash_price?: number | null;
};

type Slot = {
  start_time: string;
  end_time: string;
  booked?: number;
  booking_id?: number;
};

type ArenaCourtsResponse = {
  courts: Court[];
  source: string;
};

type SlotsResponse = {
  slots: Slot[];
  source: string;
  holiday?: boolean;
  label?: string | null;
  message?: string;
};

type BookingPayload = {
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
  booking_date: string;
};

type BookingFormState = {
  name: string;
  phone: string;
  email: string;
  add_on: string;
  add_on_price: string;
};

type CourtAddOn = {
  id: number;
  label: string;
  price: number | string;
};

const today = new Date().toISOString().split("T")[0];

const fetchArena = async (arenaId: string): Promise<Arena> => {
  const response = await fetch(`http://localhost:5000/api/arenas/${arenaId}`);

  if (!response.ok) {
    throw new Error("Failed to fetch arena");
  }

  return response.json();
};

const fetchArenaCourts = async (arenaId: string): Promise<ArenaCourtsResponse> => {
  const response = await fetch(`http://localhost:5000/api/arenas/${arenaId}/courts`);

  if (!response.ok) {
    throw new Error("Failed to fetch courts");
  }

  return response.json();
};

const fetchSlots = async (courtId: number, date: string): Promise<SlotsResponse> => {
  const response = await fetch(
    `http://localhost:5000/api/booking?court_id=${courtId}&date=${date}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch slots");
  }

  return response.json();
};

const formatTime = (value: string) =>
  value.slice(0, 5).replace(/^24:/, "00:");

const fetchCourtAddOns = async (
  courtId: number,
): Promise<{ addOns: CourtAddOn[] }> => {
  const response = await fetch(
    `http://localhost:5000/api/courts/${courtId}/add-ons`,
  );
  if (!response.ok) {
    throw new Error("Failed to fetch add-ons");
  }
  return response.json();
};

const ArenaDetail = () => {
  const { arenaId } = useParams<{ arenaId: string }>();
  const storedUser = getStoredUser();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [formData, setFormData] = useState<BookingFormState>({
    name: storedUser?.name || "",
    phone: "",
    email: storedUser?.email || "",
    add_on: "",
    add_on_price: "0",
  });
  const [findingNextOpen, setFindingNextOpen] = useState(false);
  const [selectedAddOnId, setSelectedAddOnId] = useState<string>("none");
  const queryClient = useQueryClient();

  const arenaQuery = useQuery<Arena, Error>({
    queryKey: ["arena", arenaId],
    queryFn: () => fetchArena(arenaId || ""),
    enabled: Boolean(arenaId),
  });

  const courtsQuery = useQuery<ArenaCourtsResponse, Error>({
    queryKey: ["arenaCourts", arenaId],
    queryFn: () => fetchArenaCourts(arenaId || ""),
    enabled: Boolean(arenaId),
  });

  const courts = courtsQuery.data?.courts ?? [];

  const resolvedCourtId = useMemo(() => {
    if (selectedCourtId) {
      return selectedCourtId;
    }

    return courts[0]?.id ?? null;
  }, [courts, selectedCourtId]);

  const slotsQuery = useQuery<SlotsResponse, Error>({
    queryKey: ["arenaCourtSlots", resolvedCourtId, selectedDate],
    queryFn: () => fetchSlots(resolvedCourtId as number, selectedDate),
    enabled: Boolean(resolvedCourtId && selectedDate),
  });

  const addOnsQuery = useQuery<{ addOns: CourtAddOn[] }, Error>({
    queryKey: ["courtAddOnsPublic", resolvedCourtId],
    queryFn: () => fetchCourtAddOns(resolvedCourtId as number),
    enabled: Boolean(resolvedCourtId),
  });

  const courtAddOns = addOnsQuery.data?.addOns ?? [];

  useEffect(() => {
    setSelectedAddOnId("none");
    setFormData((current) => ({
      ...current,
      add_on: "",
      add_on_price: "0",
    }));
  }, [resolvedCourtId]);

  const skipToNextOpenDay = async () => {
    if (!resolvedCourtId) return;
    setFindingNextOpen(true);
    try {
      let d = selectedDate;
      for (let i = 0; i < 60; i++) {
        d = addOneCalendarDay(d);
        const res = await fetch(
          `http://localhost:5000/api/booking?court_id=${resolvedCourtId}&date=${d}`,
        );
        const data = (await res.json()) as SlotsResponse & { holiday?: boolean };
        if (
          res.ok &&
          !data.holiday &&
          Array.isArray(data.slots) &&
          data.slots.length > 0
        ) {
          setSelectedDate(d);
          setSelectedSlot(null);
          queryClient.invalidateQueries({
            queryKey: ["arenaCourtSlots", resolvedCourtId, d],
          });
          toast.success(`Next bookable day: ${d}`);
          return;
        }
      }
      toast.info("No bookable day found in the next 60 days for this court.");
    } finally {
      setFindingNextOpen(false);
    }
  };

  const bookingMutation = useMutation({
    mutationFn: async (payload: BookingPayload) => {
      const response = await fetch("http://localhost:5000/api/book-slot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create booking");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Booking successful!");
      setSelectedSlot(null);
      setSelectedAddOnId("none");
      setFormData({
        name: storedUser?.name || "",
        phone: "",
        email: storedUser?.email || "",
        add_on: "",
        add_on_price: "0",
      });
      queryClient.invalidateQueries({
        queryKey: ["arenaCourtSlots", resolvedCourtId, selectedDate],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleBookingSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!resolvedCourtId || !selectedSlot) {
      toast.error("Select an available slot first.");
      return;
    }

    const selectedCourt = courts.find((court) => court.id === resolvedCourtId);
    const onlinePrice = Number(selectedCourt?.online_price ?? 0);
    const cashPrice = Number(selectedCourt?.cash_price ?? selectedCourt?.online_price ?? 0);
    const addOnPrice = Number(formData.add_on_price || 0);

    bookingMutation.mutate({
      court_id: resolvedCourtId,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      online_price: onlinePrice,
      cash_price: cashPrice,
      add_on: formData.add_on,
      add_on_price: addOnPrice,
      booking_date: selectedDate,
    });
  };

  if (arenaQuery.isLoading || courtsQuery.isLoading) {
    return <div className="mx-auto max-w-6xl px-6 py-16">Loading arena...</div>;
  }

  if (arenaQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16 text-red-500">
        Error: {arenaQuery.error.message}
      </div>
    );
  }

  if (courtsQuery.isError) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-16 text-red-500">
        Error: {courtsQuery.error.message}
      </div>
    );
  }

  const arena = arenaQuery.data;

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <Link to="/arenas" className="mb-6 inline-flex text-sm font-medium text-primary">
        Back to arenas
      </Link>

      <div className="mb-8 rounded-sm border border-stroke bg-white p-8 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-black dark:text-white">
            {arena?.name}
          </h1>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {arena?.status}
          </span>
        </div>
        <p className="mb-2 flex items-center gap-2 text-body-color dark:text-bodydark">
          <FaMapMarkerAlt className="text-primary" />
          {arena?.city || "City pending"}
        </p>
        <p className="text-body-color dark:text-bodydark">
          {arena?.description || "Arena details will continue to expand as the migration progresses."}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-black dark:text-white">
            Available Courts
          </h2>
          <p className="text-body-color dark:text-bodydark">
            Select a court and date to browse currently configured slots.
          </p>
        </div>

        <label className="flex flex-col gap-2 text-sm font-medium text-black dark:text-white">
          Date
          <input
            type="date"
            value={selectedDate}
            min={today}
            onChange={(event) => {
              setSelectedDate(event.target.value);
              setSelectedSlot(null);
            }}
            className="rounded-lg border border-stroke bg-transparent px-4 py-2 dark:border-strokedark"
          />
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4">
          {courts.length === 0 ? (
            <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              No courts are linked to this arena yet.
            </div>
          ) : (
            courts.map((court) => {
              const isSelected = court.id === resolvedCourtId;
              const sport = getSportPresentation(court);
              const SportIcon = sport.Icon;

              return (
                <button
                  key={court.id}
                  type="button"
                  onClick={() => {
                    setSelectedCourtId(court.id);
                    setSelectedSlot(null);
                  }}
                  className={`overflow-hidden rounded-2xl border text-left shadow-default transition ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-stroke bg-white dark:border-strokedark dark:bg-boxdark"
                  }`}
                >
                  <div className={`bg-gradient-to-r ${sport.accent} p-5`}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div
                        className="flex h-28 w-44 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10"
                        aria-hidden
                      >
                        <SportIcon className="h-20 w-20 text-white drop-shadow-md" />
                      </div>
                      {court.online_price ? (
                        <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white">
                          ${court.online_price}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-left text-white">
                      <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/80">
                        {sport.label}
                      </div>
                      <h3 className="mt-2 text-xl font-semibold">
                        {court.name}
                      </h3>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="mb-1 text-sm font-medium text-black dark:text-white">
                      {court.sport_name || sport.label}
                    </p>
                    <p className="text-sm text-body-color dark:text-bodydark">
                      Cash price: USD ${court.cash_price ?? court.online_price ?? "TBD"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <h3 className="mb-2 text-xl font-semibold text-black dark:text-white">
            Time Slots
          </h3>
          <p className="mb-4 text-sm text-body-color dark:text-bodydark">
            {resolvedCourtId
              ? `Showing slots for ${selectedDate}.`
              : "Select a court to view slots."}
          </p>

          {slotsQuery.isLoading ? (
            <div>Loading slots...</div>
          ) : slotsQuery.isError ? (
            <div className="text-red-500">Error: {slotsQuery.error.message}</div>
          ) : slotsQuery.data?.holiday ? (
            <HolidayDayBanner
              label={slotsQuery.data.label}
              message={slotsQuery.data.message}
              onNextDay={() => {
                setSelectedDate(addOneCalendarDay(selectedDate));
                setSelectedSlot(null);
              }}
              onFindNextOpen={skipToNextOpenDay}
              findNextBusy={findingNextOpen}
            />
          ) : !slotsQuery.data?.slots?.length ? (
            <div className="text-sm text-body-color dark:text-bodydark">
              No slots found for this court and date.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {slotsQuery.data.slots.map((slot, index) => (
                <button
                  key={`${slot.start_time}-${slot.end_time}-${index}`}
                  type="button"
                  disabled={slot.booked === 1}
                  onClick={() => setSelectedSlot(slot)}
                  className={`rounded-lg border px-4 py-3 text-left text-sm ${
                    slot.booked === 1
                      ? "cursor-not-allowed border-stroke bg-slate-100 text-slate-400 dark:border-strokedark dark:bg-slate-900"
                      : selectedSlot?.start_time === slot.start_time &&
                          selectedSlot?.end_time === slot.end_time
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-stroke dark:border-strokedark"
                  }`}
                >
                  <div>{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</div>
                  <div className="mt-1 text-xs">
                    {slot.booked === 1 ? "Booked" : "Available"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

          <form
            onSubmit={handleBookingSubmit}
            className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark"
          >
            <h3 className="mb-2 text-xl font-semibold text-black dark:text-white">
              Book Selected Slot
            </h3>
            <p className="mb-4 text-sm text-body-color dark:text-bodydark">
              {selectedSlot
                ? `Booking ${formatTime(selectedSlot.start_time)} - ${formatTime(selectedSlot.end_time)} on ${selectedDate}.`
                : "Choose an available slot to continue."}
            </p>

            <div className="grid gap-4">
              <input
                type="text"
                placeholder="Your name"
                value={formData.name}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, name: event.target.value }))
                }
                className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                required
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={formData.phone}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, phone: event.target.value }))
                }
                className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                required
              />
              <input
                type="email"
                placeholder="Email address"
                value={formData.email}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, email: event.target.value }))
                }
                className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                required
              />
              <label className="flex flex-col gap-2 text-sm font-medium text-black dark:text-white">
                Add-on (optional)
                <select
                  value={selectedAddOnId}
                  disabled={addOnsQuery.isLoading}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedAddOnId(value);
                    if (value === "none") {
                      setFormData((current) => ({
                        ...current,
                        add_on: "",
                        add_on_price: "0",
                      }));
                      return;
                    }
                    const row = courtAddOns.find(
                      (a) => String(a.id) === value,
                    );
                    if (row) {
                      const p = Number(row.price);
                      setFormData((current) => ({
                        ...current,
                        add_on: row.label,
                        add_on_price: String(Number.isNaN(p) ? 0 : p),
                      }));
                    }
                  }}
                  className="rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                >
                  <option value="none">No add-on</option>
                  {courtAddOns.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.label} (+$
                      {Number(a.price).toFixed(2)})
                    </option>
                  ))}
                </select>
                {courtAddOns.length === 0 && !addOnsQuery.isLoading ? (
                  <span className="text-xs font-normal text-body-color dark:text-bodydark">
                    No add-ons configured for this court yet.
                  </span>
                ) : null}
              </label>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="text-sm text-body-color dark:text-bodydark">
                Online price: USD ${courts.find((court) => court.id === resolvedCourtId)?.online_price ?? 0}
              </div>
              <button
                type="submit"
                disabled={!selectedSlot || bookingMutation.isPending}
                className="rounded-lg bg-primary px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {bookingMutation.isPending ? "Booking..." : "Confirm Booking"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ArenaDetail;
