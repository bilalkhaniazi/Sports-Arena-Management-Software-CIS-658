import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { MdOutlineStadium } from "react-icons/md";

type Arena = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  city: string | null;
  status: string;
  courtCount: number;
};

type ArenasResponse = {
  arenas: Arena[];
  source: string;
};

const fetchArenas = async (): Promise<ArenasResponse> => {
  const response = await fetch("http://localhost:5000/api/arenas");

  if (!response.ok) {
    throw new Error("Failed to fetch arenas");
  }

  return response.json();
};

const ArenasPage = () => {
  const { data, isLoading, isError, error } = useQuery<ArenasResponse, Error>({
    queryKey: ["publicArenas"],
    queryFn: fetchArenas,
  });

  if (isLoading) {
    return <div className="mx-auto max-w-5xl px-6 py-16">Loading arenas...</div>;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 text-red-500">
        Error: {error.message}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-black dark:text-white">
          Browse Arenas
        </h1>
        <p className="text-body-color dark:text-bodydark">
          Public arena discovery is now connected to a real backend endpoint.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {data?.arenas.map((arena) => (
          <div
            key={arena.id}
            className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MdOutlineStadium className="h-8 w-8" aria-hidden />
            </div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-black dark:text-white">
                {arena.name}
              </h2>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {arena.status}
              </span>
            </div>
            <p className="mb-3 text-sm text-body-color dark:text-bodydark">
              {arena.city || "City pending"}
            </p>
            <p className="mb-4 text-sm text-body-color dark:text-bodydark">
              {arena.description || "Arena details will expand as the public app is built out."}
            </p>
            <p className="mb-4 text-sm font-medium text-black dark:text-white">
              {arena.courtCount} courts
            </p>
            <Link
              to={`/arenas/${arena.id}`}
              className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
            >
              View Arena
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArenasPage;
