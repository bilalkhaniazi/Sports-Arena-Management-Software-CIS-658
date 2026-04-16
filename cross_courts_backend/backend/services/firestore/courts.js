const env = require("../../config/env");
const { getFirestore } = require("../../config/firebase");

const getCollectionName = (baseName) => `${env.firebase.collectionPrefix || ""}${baseName}`;

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).slice(0, 10);
};

const normalizeTime = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{1,2}:\d{2}$/.test(raw)) return `${raw}:00`;
  return raw;
};

const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const loadRows = async (name) => {
  const snap = await getFirestore().collection(getCollectionName(name)).get();
  return snap.docs.map((doc) => doc.data());
};

const enumerateDateRange = (fromStr, toStr) => {
  const out = [];
  const [y1, m1, d1] = fromStr.split("-").map(Number);
  const [y2, m2, d2] = toStr.split("-").map(Number);
  let cur = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  while (cur <= end) {
    const y = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, "0");
    const da = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${mo}-${da}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
};

const nextId = async (name) => {
  const rows = await loadRows(name);
  let maxId = 0;
  rows.forEach((r) => {
    const id = toNum(r.id, 0);
    if (id > maxId) maxId = id;
  });
  return maxId + 1;
};

const listCourtsByCategoryFromFirestore = async (catId) => {
  const rows = await loadRows("courts");
  return rows.filter((c) => toNum(c.cat_id) === toNum(catId) && !toNum(c.is_deleted, 0));
};

const getHolidayInfoForCourtDate = async (courtId, date) => {
  const [courts, holidays] = await Promise.all([loadRows("courts"), loadRows("arena_holidays")]);
  const court = courts.find((c) => toNum(c.id) === toNum(courtId));
  if (!court) return null;
  const arenaId = toNum(court.arena_id, -1);
  const match = holidays.find(
    (h) => toNum(h.arena_id, -1) === arenaId && normalizeDate(h.holiday_date) === normalizeDate(date),
  );
  return match ? { label: match.label || null } : null;
};

const getSlotsFromFirestore = async (courtId, date) => {
  const holidayInfo = await getHolidayInfoForCourtDate(courtId, date);
  if (holidayInfo) {
    return {
      slots: [],
      holiday: true,
      label: holidayInfo.label,
      message: holidayInfo.label ? `Closed: ${holidayInfo.label}` : "Closed for arena holiday",
      source: "holiday",
    };
  }

  const [customRows, defaultRows] = await Promise.all([loadRows("custom_slots"), loadRows("default_slots")]);
  const customSlots = customRows.filter(
    (s) => toNum(s.court_id) === toNum(courtId) && normalizeDate(s.slot_date) === normalizeDate(date),
  );
  if (customSlots.length > 0) {
    return { slots: customSlots, source: "custom", message: "Custom slots found." };
  }
  const defaultSlots = defaultRows.filter((s) => toNum(s.court_id) === toNum(courtId));
  if (defaultSlots.length === 0) {
    return {
      slots: [],
      source: "none",
      message:
        "No default slot template for this court. Configure slots in Booking Settings or add default_slots rows.",
    };
  }
  return { slots: defaultSlots, source: "default", message: "Returning default slots." };
};

const upsertCourtSchedule = async (courtId, date, defaultSlot) => {
  const firestore = getFirestore();
  const col = firestore.collection(getCollectionName("court_schedule"));
  const all = await col.get();
  const existing = all.docs.find((d) => {
    const row = d.data();
    return toNum(row.court_id) === toNum(courtId) && normalizeDate(row.slot_date) === normalizeDate(date);
  });
  if (existing) {
    await col.doc(existing.id).set({ default_slot: defaultSlot ? 1 : 0 }, { merge: true });
    return toNum(existing.data().id);
  }
  const id = await nextId("court_schedule");
  await col.doc(String(id)).set({
    id,
    court_id: toNum(courtId),
    slot_date: normalizeDate(date),
    default_slot: defaultSlot ? 1 : 0,
    _sourceTable: "court_schedule",
    _migratedAt: new Date().toISOString(),
  });
  return id;
};

const replaceCustomSlots = async (courtId, date, slots) => {
  const firestore = getFirestore();
  const col = firestore.collection(getCollectionName("custom_slots"));
  const snap = await col.get();
  const targetDate = normalizeDate(date);
  const toDelete = snap.docs.filter((d) => {
    const row = d.data();
    return toNum(row.court_id) === toNum(courtId) && normalizeDate(row.slot_date) === targetDate;
  });
  for (const doc of toDelete) {
    await col.doc(doc.id).delete();
  }
  for (const slot of slots) {
    const id = await nextId("custom_slots");
    await col.doc(String(id)).set({
      id,
      court_id: toNum(courtId),
      slot_date: targetDate,
      start_time: normalizeTime(slot.start_time),
      end_time: normalizeTime(slot.end_time),
      modified: "Yes",
      _sourceTable: "custom_slots",
      _migratedAt: new Date().toISOString(),
    });
  }
};

const getGeneratedSlotsFromFirestore = async (courtId, date) => {
  const [scheduleRows, customRows] = await Promise.all([loadRows("court_schedule"), loadRows("custom_slots")]);
  const schedule = scheduleRows.find(
    (r) => toNum(r.court_id) === toNum(courtId) && normalizeDate(r.slot_date) === normalizeDate(date),
  );
  if (schedule && toNum(schedule.default_slot) === 0) {
    const slots = customRows
      .filter((s) => toNum(s.court_id) === toNum(courtId) && normalizeDate(s.slot_date) === normalizeDate(date))
      .map((s) => ({ start_time: s.start_time, end_time: s.end_time }));
    return { court_id: String(courtId), date: normalizeDate(date), slots, source: "custom" };
  }
  const defaultSlots = [];
  for (let hour = 0; hour < 24; hour++) {
    defaultSlots.push({
      start_time: `${String(hour).padStart(2, "0")}:00:00`,
      end_time: `${String(hour + 1).padStart(2, "0")}:00:00`,
    });
  }
  return { court_id: String(courtId), date: normalizeDate(date), slots: defaultSlots, source: "default" };
};

const listCourtsFromFirestore = async () => {
  const rows = await loadRows("courts");
  return rows
    .filter((c) => !toNum(c.is_deleted, 0))
    .map((c) => ({ id: toNum(c.id), name: c.name, arena_id: c.arena_id != null ? toNum(c.arena_id) : null }));
};

const listArenaCourtsFromFirestore = async (arenaId) => {
  const [courts, sports] = await Promise.all([loadRows("courts"), loadRows("sports")]);
  const sportsById = new Map(sports.map((s) => [toNum(s.id), s.name || null]));
  return courts
    .filter((c) => toNum(c.arena_id) === toNum(arenaId))
    .map((c) => ({
      id: toNum(c.id),
      name: c.name,
      cat_id: toNum(c.cat_id),
      sport_id: c.sport_id != null ? toNum(c.sport_id) : null,
      sport_name: sportsById.get(toNum(c.sport_id, -1)) || null,
      price: toNum(c.price, 0),
      cash_price: toNum(c.cash_price, 0),
      is_deleted: toNum(c.is_deleted, 0),
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};

const createCourtInFirestore = async ({ arenaId, name, cat_id, sport_id, price, cash_price }) => {
  const id = await nextId("courts");
  await getFirestore()
    .collection(getCollectionName("courts"))
    .doc(String(id))
    .set({
      id,
      name,
      cat_id: toNum(cat_id),
      arena_id: toNum(arenaId),
      sport_id: sport_id != null ? toNum(sport_id) : null,
      price: toNum(price, 0),
      cash_price: toNum(cash_price, 0),
      is_deleted: 0,
      created_at: new Date().toISOString(),
      _sourceTable: "courts",
      _migratedAt: new Date().toISOString(),
    });
};

const updateCourtInFirestore = async ({ courtId, name, cat_id, sport_id, price, cash_price }) => {
  await getFirestore()
    .collection(getCollectionName("courts"))
    .doc(String(toNum(courtId)))
    .set(
      {
        name,
        cat_id: toNum(cat_id),
        sport_id: sport_id != null ? toNum(sport_id) : null,
        price: toNum(price, 0),
        cash_price: toNum(cash_price, 0),
      },
      { merge: true },
    );
};

const deleteCourtInFirestore = async (courtId) => {
  await getFirestore()
    .collection(getCollectionName("courts"))
    .doc(String(toNum(courtId)))
    .set({ is_deleted: 1, deleted_at: new Date().toISOString() }, { merge: true });
};

const getDefaultSlotTemplateFromFirestore = async (courtId) => {
  const rows = await loadRows("default_slots");
  return rows
    .filter((r) => toNum(r.court_id) === toNum(courtId))
    .map((r) => ({ id: toNum(r.id), start_time: r.start_time, end_time: r.end_time }))
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
};

const getSlotsRangeFromFirestore = async (courtId, from, to) => {
  const [customSlots, schedules, courts, holidays] = await Promise.all([
    loadRows("custom_slots"),
    loadRows("court_schedule"),
    loadRows("courts"),
    loadRows("arena_holidays"),
  ]);
  const custom = customSlots
    .filter((r) => {
      const d = normalizeDate(r.slot_date);
      return toNum(r.court_id) === toNum(courtId) && d >= from && d <= to;
    })
    .sort(
      (a, b) =>
        String(normalizeDate(a.slot_date)).localeCompare(String(normalizeDate(b.slot_date))) ||
        String(a.start_time).localeCompare(String(b.start_time)),
    )
    .map((r) => ({
      id: toNum(r.id),
      court_id: toNum(r.court_id),
      slot_date: normalizeDate(r.slot_date),
      start_time: r.start_time,
      end_time: r.end_time,
      modified: r.modified || "Yes",
    }));
  const defaultDates = schedules
    .filter((r) => toNum(r.court_id) === toNum(courtId) && toNum(r.default_slot) === 1)
    .map((r) => normalizeDate(r.slot_date))
    .filter((d) => d >= from && d <= to)
    .sort();
  const court = courts.find((c) => toNum(c.id) === toNum(courtId));
  const arenaId = court?.arena_id != null ? toNum(court.arena_id) : null;
  const holidayRows = arenaId
    ? holidays
        .filter((h) => toNum(h.arena_id) === arenaId)
        .map((h) => ({
          id: toNum(h.id),
          arena_id: toNum(h.arena_id),
          holiday_date: normalizeDate(h.holiday_date),
          label: h.label || null,
        }))
        .filter((h) => h.holiday_date >= from && h.holiday_date <= to)
        .sort((a, b) => a.holiday_date.localeCompare(b.holiday_date))
    : [];
  const holidaySet = new Set(holidayRows.map((h) => h.holiday_date));
  const customSlotsEnriched = custom.map((row) => ({
    ...row,
    is_arena_holiday: holidaySet.has(row.slot_date),
  }));
  return { customSlots: customSlotsEnriched, defaultDates, holidays: holidayRows };
};

const bulkApplySlotsFromFirestore = async (courtId, fromDate, toDate, slots, skipHolidays) => {
  const normalized = slots.map((s) => ({
    start_time: normalizeTime(s.start_time),
    end_time: normalizeTime(s.end_time),
  }));
  const dates = enumerateDateRange(fromDate, toDate);
  const [courts, holidays] = await Promise.all([loadRows("courts"), loadRows("arena_holidays")]);
  const court = courts.find((c) => toNum(c.id) === toNum(courtId));
  const arenaId = court?.arena_id != null ? toNum(court.arena_id) : null;
  const holidaySet = new Set(
    skipHolidays && arenaId
      ? holidays
          .filter((h) => toNum(h.arena_id) === arenaId)
          .map((h) => normalizeDate(h.holiday_date))
          .filter((d) => d >= fromDate && d <= toDate)
      : [],
  );
  let skippedDays = 0;
  for (const date of dates) {
    if (holidaySet.has(date)) {
      skippedDays += 1;
      continue;
    }
    await upsertCourtSchedule(courtId, date, false);
    await replaceCustomSlots(courtId, date, normalized);
  }
  const appliedDays = dates.length - skippedDays;
  return { appliedDays, skippedDays, patterns: normalized.length };
};

const updateCustomSlotInFirestore = async (slotId, start_time, end_time) => {
  const firestore = getFirestore();
  const ref = firestore.collection(getCollectionName("custom_slots")).doc(String(toNum(slotId)));
  const doc = await ref.get();
  if (!doc.exists) return null;
  const row = doc.data();
  await ref.set({ start_time: normalizeTime(start_time), end_time: normalizeTime(end_time) }, { merge: true });
  await upsertCourtSchedule(toNum(row.court_id), normalizeDate(row.slot_date), false);
  return { court_id: toNum(row.court_id), slot_date: normalizeDate(row.slot_date) };
};

const deleteCustomSlotInFirestore = async (slotId) => {
  const firestore = getFirestore();
  const ref = firestore.collection(getCollectionName("custom_slots")).doc(String(toNum(slotId)));
  const doc = await ref.get();
  if (!doc.exists) return null;
  const row = doc.data();
  const courtId = toNum(row.court_id);
  const date = normalizeDate(row.slot_date);
  await ref.delete();
  const rows = await loadRows("custom_slots");
  const remaining = rows.filter((r) => toNum(r.court_id) === courtId && normalizeDate(r.slot_date) === date).length;
  if (remaining === 0) {
    await upsertCourtSchedule(courtId, date, true);
  }
  return { courtId, date };
};

const resetDayToDefaultInFirestore = async (courtId, date) => {
  await upsertCourtSchedule(courtId, date, true);
  await replaceCustomSlots(courtId, date, []);
};

module.exports = {
  listCourtsByCategoryFromFirestore,
  getSlotsFromFirestore,
  upsertCourtSchedule,
  replaceCustomSlots,
  getGeneratedSlotsFromFirestore,
  listCourtsFromFirestore,
  listArenaCourtsFromFirestore,
  createCourtInFirestore,
  updateCourtInFirestore,
  deleteCourtInFirestore,
  getDefaultSlotTemplateFromFirestore,
  getSlotsRangeFromFirestore,
  bulkApplySlotsFromFirestore,
  updateCustomSlotInFirestore,
  deleteCustomSlotInFirestore,
  resetDayToDefaultInFirestore,
};
