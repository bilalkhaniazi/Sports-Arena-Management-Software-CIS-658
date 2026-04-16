import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "react-toastify";
import Breadcrumb from "../../components/Breadcrumbs/Breadcrumb";
import HolidayDayBanner from "../../components/HolidayDayBanner";
import { addOneCalendarDay } from "../../utils/bookingDates";
import {
  FaBuilding,
  FaClipboardList,
  FaClock,
  FaDollarSign,
  FaEnvelope,
  FaPhone,
  FaUser,
  FaUserPlus,
  FaCalendarAlt,
  FaSearch,
  FaCreditCard,
  FaMoneyBillWave,
  FaPlus,
  FaTrash,
} from "react-icons/fa";

const API_BASE_URL = "http://localhost:5000/api";
const getBackofficeScope = () =>
  window.location.pathname.startsWith("/admin") ? "admin" : "operator";

function todayYmd(): string {
  return format(new Date(), "yyyy-MM-dd");
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
  price: number;
  cash_price: number;
  is_deleted: number;
};

type CustomerRow = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
};

type SlotRow = {
  start_time: string;
  end_time: string;
  booked?: number;
};

type SlotsApi = {
  slots: SlotRow[];
  holiday?: boolean;
  label?: string | null;
  message?: string;
  source?: "custom" | "default" | "holiday" | "none";
};

type CourtAddOnRow = {
  id: number;
  label: string;
  price: number | string;
  sort_order?: number;
  is_active?: number;
};

const BookingManagement: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scope = getBackofficeScope();

  const [arenaId, setArenaId] = useState<number | null>(null);
  const [courtId, setCourtId] = useState<number | null>(null);
  const [bookingDate, setBookingDate] = useState(todayYmd);
  const [selectedSlot, setSelectedSlot] = useState<SlotRow | null>(null);
  const [findingNextOpen, setFindingNextOpen] = useState(false);

  const [customerPick, setCustomerPick] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [onlinePrice, setOnlinePrice] = useState("0");
  const [cashPrice, setCashPrice] = useState("0");
  const [addOn, setAddOn] = useState("");
  const [addOnPrice, setAddOnPrice] = useState("0");
  const [selectedAddOnId, setSelectedAddOnId] = useState<string>("none");
  const [newAddonLabel, setNewAddonLabel] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cash">("online");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerListOpen, setCustomerListOpen] = useState(false);
  const customerPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/auth/signin");
  }, [navigate]);

  const { data: arenasData } = useQuery({
    queryKey: ["bmArenas", scope],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/${scope}/arenas`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load arenas");
      return json.arenas as ArenaRow[];
    },
  });

  const arenas = arenasData ?? [];

  useEffect(() => {
    if (!arenaId && arenas.length > 0) setArenaId(arenas[0].id);
  }, [arenas, arenaId]);

  const { data: courtsData } = useQuery({
    queryKey: ["bmCourts", scope, arenaId],
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
    if (!courtId && courts.length > 0) setCourtId(courts[0].id);
    if (courtId && courts.length && !courts.some((c) => c.id === courtId)) {
      setCourtId(courts[0]?.id ?? null);
    }
  }, [courts, courtId]);

  const selectedCourt = useMemo(
    () => courts.find((c) => c.id === courtId) ?? null,
    [courts, courtId],
  );

  useEffect(() => {
    if (!selectedCourt) return;
    setOnlinePrice(String(selectedCourt.price ?? 0));
    setCashPrice(String(selectedCourt.cash_price ?? selectedCourt.price ?? 0));
  }, [selectedCourt?.id, selectedCourt?.price, selectedCourt?.cash_price]);

  const { data: customersData } = useQuery({
    queryKey: ["bmCustomers", scope],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/${scope}/customers`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load customers");
      return json.users as CustomerRow[];
    },
  });

  const customers = customersData ?? [];

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 50);
    return customers
      .filter((c) => {
        const name = (c.name || "").toLowerCase();
        const em = (c.email || "").toLowerCase();
        const ph = String(c.phone ?? "").toLowerCase();
        return name.includes(q) || em.includes(q) || ph.includes(q);
      })
      .slice(0, 50);
  }, [customers, customerSearch]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (
        customerPickerRef.current &&
        !customerPickerRef.current.contains(e.target as Node)
      ) {
        setCustomerListOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const bookingTotal = useMemo(() => {
    const on = Number(onlinePrice) || 0;
    const cash = Number(cashPrice) || 0;
    const add = Number(addOnPrice) || 0;
    const base = paymentMethod === "online" ? on : cash;
    return Math.round((base + add) * 100) / 100;
  }, [onlinePrice, cashPrice, addOnPrice, paymentMethod]);

  const {
    data: slotsPayload,
    isLoading: slotsLoading,
    isError: slotsError,
    error: slotsErr,
  } = useQuery({
    queryKey: ["bmSlots", courtId, bookingDate],
    queryFn: async () => {
      const q = new URLSearchParams({
        court_id: String(courtId),
        date: bookingDate,
      });
      const res = await fetch(`${API_BASE_URL}/booking?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load slots");
      return json as SlotsApi;
    },
    enabled: Boolean(courtId && bookingDate),
  });

  useEffect(() => {
    setSelectedSlot(null);
  }, [courtId, bookingDate]);

  useEffect(() => {
    setSelectedAddOnId("none");
    setAddOn("");
    setAddOnPrice("0");
  }, [courtId]);

  const { data: courtAddOnsPayload } = useQuery({
    queryKey: ["bmCourtAddOns", scope, courtId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE_URL}/${scope}/courts/${courtId}/add-ons?include_inactive=1`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load add-ons");
      return json as { addOns: CourtAddOnRow[] };
    },
    enabled: Boolean(courtId),
  });

  const allCourtAddOns = courtAddOnsPayload?.addOns ?? [];
  const activeCourtAddOns = allCourtAddOns.filter((a) => a.is_active !== 0);

  const createAddonMutation = useMutation({
    mutationFn: async () => {
      if (!courtId) throw new Error("Select a court.");
      const label = newAddonLabel.trim();
      if (!label) throw new Error("Enter an add-on name.");
      const res = await fetch(
        `${API_BASE_URL}/${scope}/courts/${courtId}/add-ons`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label,
            price: Number(newAddonPrice) || 0,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create add-on");
      return json;
    },
    onSuccess: () => {
      toast.success("Add-on saved.");
      setNewAddonLabel("");
      setNewAddonPrice("0");
      queryClient.invalidateQueries({ queryKey: ["bmCourtAddOns", scope, courtId] });
      queryClient.invalidateQueries({ queryKey: ["courtAddOnsPublic", courtId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAddonMutation = useMutation({
    mutationFn: async (addonId: number) => {
      if (!courtId) throw new Error("No court.");
      const res = await fetch(
        `${API_BASE_URL}/${scope}/courts/${courtId}/add-ons/${addonId}`,
        { method: "DELETE" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not remove add-on");
      return json;
    },
    onSuccess: () => {
      toast.success("Add-on removed.");
      setSelectedAddOnId("none");
      setAddOn("");
      setAddOnPrice("0");
      queryClient.invalidateQueries({ queryKey: ["bmCourtAddOns", scope, courtId] });
      queryClient.invalidateQueries({ queryKey: ["courtAddOnsPublic", courtId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyCustomer = (idStr: string) => {
    setCustomerPick(idStr);
    if (!idStr) {
      setCustomerSearch("");
      return;
    }
    const u = customers.find((c) => String(c.id) === idStr);
    if (!u) return;
    setName(u.name);
    setEmail(u.email);
    setPhone(u.phone != null && String(u.phone).trim() !== "" ? String(u.phone) : "");
    setCustomerSearch(`${u.name} · ${u.email}`);
    setCustomerListOpen(false);
  };

  const clearCustomerPick = () => {
    setCustomerPick("");
    setCustomerSearch("");
  };

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!courtId || !selectedSlot) {
        throw new Error("Select a court, date, and time slot.");
      }
      const res = await fetch(`${API_BASE_URL}/${scope}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          court_id: courtId,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          online_price: Number(onlinePrice) || 0,
          cash_price: Number(cashPrice) || 0,
          add_on: addOn.trim(),
          add_on_price: Number(addOnPrice) || 0,
          booking_date: bookingDate,
          payment_method: paymentMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.message || "Booking failed");
      return json;
    },
    onSuccess: () => {
      toast.success("Booking created.");
      setSelectedSlot(null);
      queryClient.invalidateQueries({ queryKey: ["bmSlots"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const skipToNextOpenDay = async () => {
    if (!courtId) return;
    setFindingNextOpen(true);
    try {
      let d = bookingDate;
      for (let i = 0; i < 60; i++) {
        d = addOneCalendarDay(d);
        const res = await fetch(
          `${API_BASE_URL}/booking?court_id=${courtId}&date=${d}`,
        );
        const data = (await res.json()) as SlotsApi;
        if (
          res.ok &&
          !data.holiday &&
          Array.isArray(data.slots) &&
          data.slots.length > 0
        ) {
          setBookingDate(d);
          toast.success(`Next bookable day: ${d}`);
          return;
        }
      }
      toast.info("No bookable day found in the next 60 days.");
    } finally {
      setFindingNextOpen(false);
    }
  };

  const formatTime = (t: string) => String(t).slice(0, 5);

  return (
    <>
      <Breadcrumb pageName="Booking Management" />

      <div className="mb-6 flex flex-wrap items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
        <FaUserPlus className="mt-1 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-body-color dark:text-bodydark">
          Choose an <strong>arena</strong> and <strong>court</strong>, pick a{" "}
          <strong>date</strong> and <strong>slot</strong>, then either select a registered
          customer or enter details manually. Default prices come from the court; you can
          adjust them before confirming.
        </p>
      </div>

      <div className="mb-6 grid gap-4 rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark lg:grid-cols-3">
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
            <FaBuilding className="h-4 w-4 text-primary" aria-hidden />
            Arena
          </label>
          <select
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
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
            <FaClipboardList className="h-4 w-4 text-primary" aria-hidden />
            Court
          </label>
          <select
            value={courtId ?? ""}
            onChange={(e) => setCourtId(Number(e.target.value))}
            disabled={!arenaId || courts.length === 0}
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 disabled:opacity-50 dark:border-strokedark"
          >
            {courts.length === 0 ? (
              <option value="">No courts for this arena</option>
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
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-black dark:text-white">
            <FaCalendarAlt className="h-4 w-4 text-primary" aria-hidden />
            Date
          </label>
          <input
            type="date"
            value={bookingDate}
            min={todayYmd()}
            onChange={(e) => setBookingDate(e.target.value)}
            className="w-full rounded-lg border border-stroke px-4 py-3 dark:border-strokedark"
          />
        </div>
      </div>

      {courtId && selectedCourt ? (
        <div className="mb-6 rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <h3 className="mb-1 text-lg font-semibold text-black dark:text-white">
            Add-ons for this court
          </h3>
          <p className="mb-4 text-xs text-body-color dark:text-bodydark">
            Each court has its own list (e.g. basketball vs padel). Customers choose from these
            when booking online; prices apply on top of the slot price.
          </p>
          {allCourtAddOns.length === 0 ? (
            <p className="mb-4 text-sm text-body-color dark:text-bodydark">
              No add-ons yet. Add one below.
            </p>
          ) : (
            <ul className="mb-4 space-y-2">
              {allCourtAddOns.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark"
                >
                  <span className="font-medium text-black dark:text-white">
                    {row.label}
                    {row.is_active === 0 ? (
                      <span className="ml-2 text-xs font-normal text-body-color">(inactive)</span>
                    ) : null}
                  </span>
                  <span className="text-body-color dark:text-bodydark">
                    USD {Number(row.price).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded border border-stroke px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-strokedark dark:hover:bg-red-950/30"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove add-on "${row.label}"? This does not affect past bookings.`,
                        )
                      ) {
                        deleteAddonMutation.mutate(row.id);
                      }
                    }}
                    disabled={deleteAddonMutation.isPending}
                  >
                    <FaTrash className="h-3 w-3" aria-hidden />
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-3 border-t border-stroke pt-4 dark:border-strokedark">
            <div className="min-w-[140px] flex-1">
              <label className="mb-1 block text-xs font-medium">Name</label>
              <input
                value={newAddonLabel}
                onChange={(e) => setNewAddonLabel(e.target.value)}
                placeholder="e.g. Ball rental"
                className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark"
              />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs font-medium">Price (USD)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={newAddonPrice}
                onChange={(e) => setNewAddonPrice(e.target.value)}
                className="w-full rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark"
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={createAddonMutation.isPending || !newAddonLabel.trim()}
              onClick={() => createAddonMutation.mutate()}
            >
              <FaPlus className="h-3.5 w-3.5" aria-hidden />
              Add add-on
            </button>
          </div>
        </div>
      ) : null}

      {!courtId ? (
        <p className="text-body-color dark:text-bodydark">Select an arena with courts.</p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
              <FaClock className="h-5 w-5 text-primary" aria-hidden />
              Available slots
            </h2>
            <p className="mb-4 text-sm text-body-color dark:text-bodydark">
              {format(parseISO(bookingDate), "EEEE, MMM d, yyyy")}
              {selectedCourt ? (
                <span className="ml-2 font-medium text-black dark:text-white">
                  · {selectedCourt.name}
                </span>
              ) : null}
            </p>

            {slotsLoading ? (
              <p className="text-sm text-body-color">Loading slots…</p>
            ) : slotsError ? (
              <p className="text-sm text-red-600 dark:text-red-400">
                {(slotsErr as Error)?.message || "Failed to load slots."}
              </p>
            ) : slotsPayload?.holiday ? (
              <HolidayDayBanner
                label={slotsPayload.label}
                message={slotsPayload.message}
                onNextDay={() => setBookingDate(addOneCalendarDay(bookingDate))}
                onFindNextOpen={skipToNextOpenDay}
                findNextBusy={findingNextOpen}
              />
            ) : !slotsPayload?.slots?.length ? (
              slotsPayload?.source === "none" ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-950/40">
                  <p className="mb-2 font-medium text-amber-900 dark:text-amber-100">
                    No slot schedule for this court
                  </p>
                  <p className="text-body-color dark:text-bodydark">
                    {slotsPayload.message ??
                      "Add a default template or apply custom slots in Booking Settings."}{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline hover:no-underline"
                      onClick={() => navigate(`/${scope}/booking-settings`)}
                    >
                      Open Booking Settings
                    </button>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-body-color">No slots for this day.</p>
              )
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {slotsPayload.slots.map((slot, idx) => {
                  const taken = slot.booked === 1;
                  const sel =
                    selectedSlot &&
                    selectedSlot.start_time === slot.start_time &&
                    selectedSlot.end_time === slot.end_time;
                  return (
                    <button
                      key={`${slot.start_time}-${slot.end_time}-${idx}`}
                      type="button"
                      disabled={taken}
                      onClick={() => setSelectedSlot(slot)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        taken
                          ? "cursor-not-allowed border-stroke bg-slate-100 text-slate-400 dark:border-strokedark dark:bg-slate-900"
                          : sel
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-stroke hover:border-primary/50 dark:border-strokedark"
                      }`}
                    >
                      <div className="font-mono">
                        {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                      </div>
                      <div className="text-xs">
                        {taken ? "Booked" : "Available"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                <FaUser className="h-5 w-5 text-primary" aria-hidden />
                Customer
              </h3>
              <div className="relative mb-4" ref={customerPickerRef}>
                <label className="mb-1 block text-xs font-medium">
                  Search registered users (optional)
                </label>
                <div className="relative">
                  <FaSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-body-color" />
                  <input
                    type="search"
                    autoComplete="off"
                    placeholder="Type name, email, or phone…"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCustomerListOpen(true);
                      if (customerPick) setCustomerPick("");
                    }}
                    onFocus={() => setCustomerListOpen(true)}
                    className="w-full rounded-lg border border-stroke py-2.5 pl-9 pr-3 text-sm dark:border-strokedark"
                  />
                </div>
                {customerPick ? (
                  <p className="mt-2 text-xs text-body-color dark:text-bodydark">
                    Linked to user #{customerPick}{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline hover:no-underline"
                      onClick={clearCustomerPick}
                    >
                      Clear
                    </button>
                  </p>
                ) : null}
                {customerListOpen && !customerPick && filteredCustomers.length > 0 ? (
                  <ul
                    className="absolute z-20 mt-1 max-h-48 w-full max-w-[min(100%,380px)] overflow-auto rounded-lg border border-stroke bg-white py-1 text-sm shadow-lg dark:border-strokedark dark:bg-boxdark"
                    role="listbox"
                  >
                    {filteredCustomers.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          role="option"
                          className="w-full px-3 py-2 text-left hover:bg-primary/10 dark:hover:bg-primary/20"
                          onClick={() => applyCustomer(String(u.id))}
                        >
                          <span className="font-medium text-black dark:text-white">{u.name}</span>
                          <span className="block text-xs text-body-color">{u.email}</span>
                          {u.phone ? (
                            <span className="text-xs text-body-color">{u.phone}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {customerListOpen &&
                !customerPick &&
                customerSearch.trim() &&
                filteredCustomers.length === 0 ? (
                  <p className="mt-2 text-xs text-body-color">No matching users.</p>
                ) : null}
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                    placeholder="Customer name"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs">
                    <FaPhone className="h-3 w-3" /> Phone
                  </label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                    placeholder="Phone"
                  />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1 text-xs">
                    <FaEnvelope className="h-3 w-3" /> Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                    placeholder="Email"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-black dark:text-white">
                <FaDollarSign className="h-5 w-5 text-primary" aria-hidden />
                Pricing (editable)
              </h3>
              <p className="mb-3 text-xs text-body-color dark:text-bodydark">
                Defaults load from the court. Choose how the customer paid; the total uses that
                rate plus any add-on.
              </p>
              <fieldset className="mb-4">
                <legend className="mb-2 text-xs font-medium text-black dark:text-white">
                  Customer paid with
                </legend>
                <div className="flex flex-wrap gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="bm-payment"
                      className="text-primary"
                      checked={paymentMethod === "online"}
                      onChange={() => setPaymentMethod("online")}
                    />
                    <FaCreditCard className="text-primary" aria-hidden />
                    Online
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-stroke px-3 py-2 text-sm dark:border-strokedark has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="bm-payment"
                      className="text-primary"
                      checked={paymentMethod === "cash"}
                      onChange={() => setPaymentMethod("cash")}
                    />
                    <FaMoneyBillWave className="text-primary" aria-hidden />
                    Cash
                  </label>
                </div>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs">
                    Online price {paymentMethod === "online" ? "(used for total)" : ""}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={onlinePrice}
                    onChange={(e) => setOnlinePrice(e.target.value)}
                    className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs">
                    Cash price {paymentMethod === "cash" ? "(used for total)" : ""}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={cashPrice}
                    onChange={(e) => setCashPrice(e.target.value)}
                    className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs">Add-on</label>
                  <select
                    value={selectedAddOnId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedAddOnId(value);
                      if (value === "none") {
                        setAddOn("");
                        setAddOnPrice("0");
                        return;
                      }
                      const row = activeCourtAddOns.find(
                        (a) => String(a.id) === value,
                      );
                      if (row) {
                        setAddOn(row.label);
                        setAddOnPrice(String(Number(row.price) || 0));
                      }
                    }}
                    className="w-full rounded-lg border border-stroke px-3 py-2 dark:border-strokedark"
                  >
                    <option value="none">No add-on</option>
                    {activeCourtAddOns.map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.label} (+$
                        {Number(a.price).toFixed(2)})
                      </option>
                    ))}
                  </select>
                  {activeCourtAddOns.length === 0 ? (
                    <p className="mt-1 text-xs text-body-color dark:text-bodydark">
                      Define add-ons for this court in the section above.
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-stroke pt-4 dark:border-strokedark">
                <span className="text-sm font-semibold text-black dark:text-white">Total</span>
                <span className="text-lg font-bold text-primary">
                  {bookingTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={
                bookMutation.isPending ||
                !selectedSlot ||
                !name.trim() ||
                !phone.trim() ||
                !email.trim() ||
                Boolean(slotsPayload?.holiday)
              }
              onClick={() => bookMutation.mutate()}
              className="w-full rounded-lg bg-primary px-5 py-3 text-center text-sm font-medium text-white disabled:opacity-50"
            >
              {bookMutation.isPending ? "Creating booking…" : "Confirm booking"}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default BookingManagement;
