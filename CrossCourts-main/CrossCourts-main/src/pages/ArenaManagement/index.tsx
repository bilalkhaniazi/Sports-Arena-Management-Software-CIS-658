import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

import Breadcrumb from '../../components/Breadcrumbs/Breadcrumb';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

const API_BASE_URL = 'http://localhost:5000/api';
const getBackofficeScope = () =>
  window.location.pathname.startsWith('/admin') ? 'admin' : 'operator';

type ArenaRecord = {
  id: number;
  name: string;
  slug: string;
  city: string | null;
  description: string | null;
  status: string;
  courtCount: number;
};

type ArenasResponse = {
  arenas: ArenaRecord[];
};

type ArenaFormState = {
  name: string;
  slug: string;
  city: string;
  description: string;
  status: string;
};

type CourtRecord = {
  id: number;
  name: string;
  cat_id: number;
  sport_id: number | null;
  sport_name: string | null;
  price: number;
  cash_price: number;
  is_deleted: number;
};

type CourtsResponse = {
  courts: CourtRecord[];
};

type CourtFormState = {
  name: string;
  cat_id: string;
  sport_id: string;
  price: string;
  cash_price: string;
};

const sportOptions = [
  { label: 'Cricket', catId: 1, sportId: 1 },
  { label: 'Football', catId: 2, sportId: 2 },
  { label: 'Padel', catId: 3, sportId: 3 },
  { label: 'Basketball', catId: 4, sportId: 4 },
  { label: 'Baseball', catId: 5, sportId: 5 },
];

const emptyForm: ArenaFormState = {
  name: '',
  slug: '',
  city: '',
  description: '',
  status: 'active',
};

const emptyCourtForm: CourtFormState = {
  name: '',
  cat_id: '1',
  sport_id: '1',
  price: '0',
  cash_price: '0',
};

const fetchArenas = async (): Promise<ArenasResponse> => {
  const response = await fetch(`${API_BASE_URL}/${getBackofficeScope()}/arenas`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch arenas');
  }
  return data;
};

const fetchArenaCourts = async (arenaId: number): Promise<CourtsResponse> => {
  const response = await fetch(
    `${API_BASE_URL}/${getBackofficeScope()}/arenas/${arenaId}/courts`,
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch courts');
  }
  return data;
};

const ArenaManagement: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingArenaId, setEditingArenaId] = useState<number | null>(null);
  const [selectedArenaId, setSelectedArenaId] = useState<number | null>(null);
  const [editingCourtId, setEditingCourtId] = useState<number | null>(null);
  const [form, setForm] = useState<ArenaFormState>(emptyForm);
  const [courtForm, setCourtForm] = useState<CourtFormState>(emptyCourtForm);
  const [arenaFormOpen, setArenaFormOpen] = useState(false);
  const [courtFormOpen, setCourtFormOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/auth/signin');
    }
  }, [navigate]);

  const { data, isLoading, isError, error } = useQuery<ArenasResponse, Error>({
    queryKey: ['managedArenas', getBackofficeScope()],
    queryFn: fetchArenas,
  });

  const arenas = useMemo(() => data?.arenas ?? [], [data]);

  useEffect(() => {
    if (!selectedArenaId && arenas.length > 0) {
      setSelectedArenaId(arenas[0].id);
    }
  }, [arenas, selectedArenaId]);

  const selectedArena = useMemo(
    () => arenas.find((arena) => arena.id === selectedArenaId) ?? null,
    [arenas, selectedArenaId],
  );

  const {
    data: courtsData,
    isLoading: isCourtsLoading,
    isError: isCourtsError,
    error: courtsError,
  } = useQuery<CourtsResponse, Error>({
    queryKey: ['arenaCourts', getBackofficeScope(), selectedArenaId],
    queryFn: () => fetchArenaCourts(selectedArenaId as number),
    enabled: Boolean(selectedArenaId),
  });

  const courts = courtsData?.courts ?? [];
  const activeCourts = courts.filter((court) => !court.is_deleted);
  const deletedCourts = courts.filter((court) => court.is_deleted);

  const saveArenaMutation = useMutation({
    mutationFn: async ({
      arenaId,
      payload,
    }: {
      arenaId: number | null;
      payload: ArenaFormState;
    }) => {
      const method = arenaId ? 'PUT' : 'POST';
      const endpoint = arenaId
        ? `${API_BASE_URL}/${getBackofficeScope()}/arenas/${arenaId}`
        : `${API_BASE_URL}/${getBackofficeScope()}/arenas`;

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to save arena');
      }
      return responseData;
    },
    onSuccess: (responseData) => {
      toast.success(responseData.message || 'Arena saved successfully.');
      setEditingArenaId(null);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['managedArenas'] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const saveCourtMutation = useMutation({
    mutationFn: async () => {
      if (!selectedArenaId) {
        throw new Error('Select an arena first');
      }

      const method = editingCourtId ? 'PUT' : 'POST';
      const endpoint = editingCourtId
        ? `${API_BASE_URL}/${getBackofficeScope()}/arenas/${selectedArenaId}/courts/${editingCourtId}`
        : `${API_BASE_URL}/${getBackofficeScope()}/arenas/${selectedArenaId}/courts`;

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: courtForm.name,
          cat_id: Number(courtForm.cat_id),
          sport_id: Number(courtForm.sport_id),
          price: Number(courtForm.price),
          cash_price: Number(courtForm.cash_price),
        }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to save court');
      }
      return responseData;
    },
    onSuccess: (responseData) => {
      toast.success(responseData.message || 'Court saved successfully.');
      setEditingCourtId(null);
      setCourtForm(emptyCourtForm);
      queryClient.invalidateQueries({ queryKey: ['managedArenas'] });
      queryClient.invalidateQueries({ queryKey: ['arenaCourts'] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const deleteCourtMutation = useMutation({
    mutationFn: async (courtId: number) => {
      if (!selectedArenaId) {
        throw new Error('Select an arena first');
      }

      const response = await fetch(
        `${API_BASE_URL}/${getBackofficeScope()}/arenas/${selectedArenaId}/courts/${courtId}`,
        { method: 'DELETE' },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete court');
      }
      return data;
    },
    onSuccess: (responseData) => {
      toast.success(responseData.message);
      queryClient.invalidateQueries({ queryKey: ['managedArenas'] });
      queryClient.invalidateQueries({ queryKey: ['arenaCourts'] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  const startEditing = (arena?: ArenaRecord) => {
    setArenaFormOpen(true);
    if (!arena) {
      setEditingArenaId(null);
      setForm(emptyForm);
      return;
    }
    setEditingArenaId(arena.id);
    setForm({
      name: arena.name,
      slug: arena.slug,
      city: arena.city || '',
      description: arena.description || '',
      status: arena.status || 'active',
    });
  };

  const startCourtEditing = (court?: CourtRecord) => {
    setCourtFormOpen(true);
    if (!court) {
      setEditingCourtId(null);
      setCourtForm(emptyCourtForm);
      return;
    }

    setEditingCourtId(court.id);
    setCourtForm({
      name: court.name,
      cat_id: String(court.cat_id ?? 1),
      sport_id: String(court.sport_id ?? court.cat_id ?? 1),
      price: String(court.price ?? 0),
      cash_price: String(court.cash_price ?? 0),
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveArenaMutation.mutate({ arenaId: editingArenaId, payload: form });
  };

  const handleCourtSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveCourtMutation.mutate();
  };

  if (isLoading) {
    return (
      <>
        <Breadcrumb pageName="Arena Management" />
        <div>Loading arenas...</div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <Breadcrumb pageName="Arena Management" />
        <div className="text-red-500">Error: {error.message}</div>
      </>
    );
  }

  return (
    <>
      <Breadcrumb pageName="Arena Management" />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="text-sm text-body-color dark:text-bodydark">Total Arenas</div>
          <div className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {arenas.length}
          </div>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="text-sm text-body-color dark:text-bodydark">Active Arenas</div>
          <div className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {arenas.filter((arena) => arena.status === 'active').length}
          </div>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="text-sm text-body-color dark:text-bodydark">Live Courts</div>
          <div className="mt-2 text-2xl font-semibold text-black dark:text-white">
            {arenas.reduce((sum, arena) => sum + Number(arena.courtCount || 0), 0)}
          </div>
        </div>
        <div className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
          <div className="text-sm text-body-color dark:text-bodydark">Selected Arena</div>
          <div className="mt-2 text-lg font-semibold text-black dark:text-white">
            {selectedArena?.name || 'None'}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-white">
                  Existing Arenas
                </h2>
                <p className="text-sm text-body-color dark:text-bodydark">
                  Select an arena, edit its details, then manage its courts below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => startEditing()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
              >
                New Arena
              </button>
            </div>

            <div className="grid gap-4">
              {arenas.map((arena) => (
                <button
                  key={arena.id}
                  type="button"
                  onClick={() => setSelectedArenaId(arena.id)}
                  className={`rounded-xl border p-5 text-left transition ${
                    selectedArenaId === arena.id
                      ? 'border-primary bg-primary/5'
                      : 'border-stroke dark:border-strokedark'
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-black dark:text-white">
                        {arena.name}
                      </h3>
                      <p className="text-sm text-body-color dark:text-bodydark">
                        {arena.city || 'City not set'}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {arena.status}
                    </span>
                  </div>
                  <p className="mb-3 text-sm text-body-color dark:text-bodydark">
                    {arena.description || 'No description provided yet.'}
                  </p>
                  <div className="mb-4 flex flex-wrap gap-3 text-sm text-body-color dark:text-bodydark">
                    <span>Slug: {arena.slug}</span>
                    <span>Courts: {arena.courtCount}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEditing(arena);
                    }}
                    className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary"
                  >
                    Edit Arena
                  </button>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-black dark:text-white">
                  Court Management
                </h2>
                <p className="text-sm text-body-color dark:text-bodydark">
                  Add cricket, football, padel, basketball, or baseball courts to the selected arena.
                </p>
              </div>
              <button
                type="button"
                onClick={() => startCourtEditing()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
              >
                New Court
              </button>
            </div>

            {isCourtsLoading ? <div>Loading courts...</div> : null}
            {isCourtsError ? (
              <div className="text-red-500">Error: {courtsError?.message}</div>
            ) : null}

            {selectedArena ? (
              <>
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  If a court is deleted, it is removed from active management but its historical booking revenue remains visible in reports with a deleted-court label.
                </div>

                <div className="mb-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                    <div className="text-sm text-body-color dark:text-bodydark">Active Courts</div>
                    <div className="mt-2 text-2xl font-semibold text-black dark:text-white">
                      {activeCourts.length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-stroke p-4 dark:border-strokedark">
                    <div className="text-sm text-body-color dark:text-bodydark">Deleted Courts</div>
                    <div className="mt-2 text-2xl font-semibold text-black dark:text-white">
                      {deletedCourts.length}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  {courts.map((court) => (
                    <div
                      key={court.id}
                      className={`rounded-xl border p-4 ${
                        court.is_deleted
                          ? 'border-amber-300 bg-amber-50'
                          : 'border-stroke dark:border-strokedark'
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-black dark:text-white">
                            {court.name}
                          </h3>
                          <p className="text-sm text-body-color dark:text-bodydark">
                            {court.sport_name || 'Sport not set'}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {court.is_deleted ? 'Deleted court' : 'Active court'}
                        </span>
                      </div>
                      <div className="mb-3 flex flex-wrap gap-3 text-sm text-body-color dark:text-bodydark">
                        <span>Online: ${Number(court.price || 0).toFixed(2)}</span>
                        <span>Cash: ${Number(court.cash_price || 0).toFixed(2)}</span>
                      </div>
                      {!court.is_deleted ? (
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => startCourtEditing(court)}
                            className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary"
                          >
                            Edit Court
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCourtMutation.mutate(court.id)}
                            className="rounded-lg border border-rose-500 px-4 py-2 text-sm font-medium text-rose-600"
                          >
                            Delete Court
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-amber-900">
                          This court has been deleted from live inventory. Historical revenue from past bookings still stays on the dashboard and reports.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div>Select an arena to manage its courts.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stroke p-6 dark:border-strokedark">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-black dark:text-white">
                  {editingArenaId ? 'Edit Arena' : 'Create Arena'}
                </h2>
                <p className="mt-1 text-sm text-body-color dark:text-bodydark">
                  Update the venue identity, status, and customer-facing description.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setArenaFormOpen((open) => !open)}
                aria-expanded={arenaFormOpen}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-stroke bg-gray-50 px-4 py-2.5 text-sm font-medium text-black hover:bg-gray-100 dark:border-strokedark dark:bg-meta-4 dark:text-white dark:hover:bg-opacity-80"
              >
                {arenaFormOpen ? (
                  <>
                    <FaChevronUp className="h-3.5 w-3.5" aria-hidden />
                    Hide form
                  </>
                ) : (
                  <>
                    <FaChevronDown className="h-3.5 w-3.5" aria-hidden />
                    Show form
                  </>
                )}
              </button>
            </div>
            {arenaFormOpen ? (
          <form
            onSubmit={handleSubmit}
            className="p-6 pt-4"
          >
            <div className="grid gap-5">
              <div>
                <label
                  htmlFor="arena-name"
                  className="mb-1.5 block text-sm font-medium text-black dark:text-white"
                >
                  Arena name
                </label>
                <p className="mb-2 text-xs text-body-color dark:text-bodydark">
                  The title customers see when browsing or booking (not the URL).
                </p>
                <input
                  id="arena-name"
                  type="text"
                  placeholder="e.g. Cross Courts Brooklyn"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                  required
                  autoComplete="off"
                />
              </div>
              <div>
                <label
                  htmlFor="arena-slug"
                  className="mb-1.5 block text-sm font-medium text-black dark:text-white"
                >
                  URL slug
                </label>
                <p className="mb-2 text-xs text-body-color dark:text-bodydark">
                  Short code for links: lowercase, use hyphens—no spaces. Example path:{' '}
                  <span className="font-mono text-xs">/arenas/your-slug</span>.
                </p>
                <input
                  id="arena-slug"
                  type="text"
                  placeholder="e.g. cross-courts-brooklyn"
                  value={form.slug}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, slug: event.target.value }))
                  }
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                  required
                  autoComplete="off"
                />
              </div>
              <div>
                <label
                  htmlFor="arena-city"
                  className="mb-1.5 block text-sm font-medium text-black dark:text-white"
                >
                  City / area
                </label>
                <p className="mb-2 text-xs text-body-color dark:text-bodydark">
                  Optional. Shown on arena cards and search (neighborhood, city, state).
                </p>
                <input
                  id="arena-city"
                  type="text"
                  placeholder="e.g. Brooklyn, NY"
                  value={form.city}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, city: event.target.value }))
                  }
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                  autoComplete="off"
                />
              </div>
              <div>
                <label
                  htmlFor="arena-status"
                  className="mb-1.5 block text-sm font-medium text-black dark:text-white"
                >
                  Status
                </label>
                <p className="mb-2 text-xs text-body-color dark:text-bodydark">
                  Active = listed and bookable. Draft = work in progress (hide from public). Inactive = closed.
                </p>
                <select
                  id="arena-status"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value }))
                  }
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                >
                  <option value="active">Active — open for bookings</option>
                  <option value="draft">Draft — not shown to customers</option>
                  <option value="inactive">Inactive — temporarily closed</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="arena-description"
                  className="mb-1.5 block text-sm font-medium text-black dark:text-white"
                >
                  Description
                </label>
                <p className="mb-2 text-xs text-body-color dark:text-bodydark">
                  Optional. Parking, directions, surface type, amenities—helps customers choose your venue.
                </p>
                <textarea
                  id="arena-description"
                  rows={6}
                  placeholder="e.g. Outdoor cricket turf with floodlights. Free parking on site. Enter via Main St."
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                disabled={saveArenaMutation.isPending}
                className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {saveArenaMutation.isPending
                  ? 'Saving...'
                  : editingArenaId
                    ? 'Save Changes'
                    : 'Create Arena'}
              </button>
              <button
                type="button"
                onClick={() => startEditing()}
                className="rounded-lg border border-stroke px-5 py-3 text-sm dark:border-strokedark"
              >
                Clear
              </button>
            </div>
          </form>
            ) : null}
          </div>

          <div className="rounded-sm border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stroke p-6 dark:border-strokedark">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold text-black dark:text-white">
                  {editingCourtId ? 'Edit Court' : 'Add Court'}
                </h2>
                <p className="mt-1 text-sm text-body-color dark:text-bodydark">
                  Suggested setup: keep court creation in arena management, and use booking settings only for slot timing per selected court.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCourtFormOpen((open) => !open)}
                aria-expanded={courtFormOpen}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-stroke bg-gray-50 px-4 py-2.5 text-sm font-medium text-black hover:bg-gray-100 dark:border-strokedark dark:bg-meta-4 dark:text-white dark:hover:bg-opacity-80"
              >
                {courtFormOpen ? (
                  <>
                    <FaChevronUp className="h-3.5 w-3.5" aria-hidden />
                    Hide form
                  </>
                ) : (
                  <>
                    <FaChevronDown className="h-3.5 w-3.5" aria-hidden />
                    Show form
                  </>
                )}
              </button>
            </div>
            {courtFormOpen ? (
          <form
            onSubmit={handleCourtSubmit}
            className="p-6 pt-4"
          >
            <div className="grid gap-5">
              <div>
                <label
                  htmlFor="court-name"
                  className="mb-1.5 block text-sm font-medium text-black dark:text-white"
                >
                  Court name
                </label>
                <p className="mb-2 text-xs text-body-color dark:text-bodydark">
                  A label for this pitch or court inside the selected arena (shown on booking screens).
                </p>
                <input
                  id="court-name"
                  type="text"
                  placeholder="e.g. Field A — Main cricket turf"
                  value={courtForm.name}
                  onChange={(event) =>
                    setCourtForm((current) => ({ ...current, name: event.target.value }))
                  }
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                  required
                  autoComplete="off"
                />
              </div>
              <div>
                <label
                  htmlFor="court-sport"
                  className="mb-1.5 block text-sm font-medium text-black dark:text-white"
                >
                  Sport
                </label>
                <p className="mb-2 text-xs text-body-color dark:text-bodydark">
                  Drives sport type and internal category for schedules and reporting.
                </p>
                <select
                  id="court-sport"
                  value={courtForm.sport_id}
                  onChange={(event) => {
                    const selectedSport = sportOptions.find(
                      (option) => option.sportId === Number(event.target.value),
                    );
                    setCourtForm((current) => ({
                      ...current,
                      sport_id: event.target.value,
                      cat_id: String(selectedSport?.catId || 1),
                    }));
                  }}
                  className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                >
                  {sportOptions.map((sport) => (
                    <option key={sport.sportId} value={sport.sportId}>
                      {sport.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="court-price-online"
                    className="mb-1.5 block text-sm font-medium text-black dark:text-white"
                  >
                    Online price (USD)
                  </label>
                  <p className="mb-2 text-xs text-body-color dark:text-bodydark">
                    Price per booking slot when the customer pays online (card/app).
                  </p>
                  <input
                    id="court-price-online"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 120.00"
                    value={courtForm.price}
                    onChange={(event) =>
                      setCourtForm((current) => ({ ...current, price: event.target.value }))
                    }
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                  />
                </div>
                <div>
                  <label
                    htmlFor="court-price-cash"
                    className="mb-1.5 block text-sm font-medium text-black dark:text-white"
                  >
                    Cash / walk-in price (USD)
                  </label>
                  <p className="mb-2 text-xs text-body-color dark:text-bodydark">
                    Optional. On-site or cash rate if it differs from online (can match online).
                  </p>
                  <input
                    id="court-price-cash"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 135.00"
                    value={courtForm.cash_price}
                    onChange={(event) =>
                      setCourtForm((current) => ({
                        ...current,
                        cash_price: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 dark:border-strokedark"
                  />
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                disabled={saveCourtMutation.isPending || !selectedArenaId}
                className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {saveCourtMutation.isPending
                  ? 'Saving...'
                  : editingCourtId
                    ? 'Save Court'
                    : 'Create Court'}
              </button>
              <button
                type="button"
                onClick={() => startCourtEditing()}
                className="rounded-lg border border-stroke px-5 py-3 text-sm dark:border-strokedark"
              >
                Clear
              </button>
            </div>
          </form>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
};

export default ArenaManagement;
