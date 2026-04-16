import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { clearStoredAuth, getStoredUser } from "../../utils/auth";

type MeResponse = {
  user: {
    id: number;
    name: string;
    email: string;
    title?: string;
    role: "admin" | "operator" | "customer";
  };
};

const fetchCurrentUser = async (): Promise<MeResponse> => {
  const token = localStorage.getItem("token");
  const response = await fetch("http://localhost:5000/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to load profile");
  }

  return data;
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const storedUser = getStoredUser();
  const { data, isLoading, isError, error } = useQuery<MeResponse, Error>({
    queryKey: ["customerProfile"],
    queryFn: fetchCurrentUser,
  });

  const user = data?.user ?? storedUser;

  if (isLoading) {
    return <div className="mx-auto max-w-5xl px-6 py-16">Loading profile...</div>;
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-16 text-red-500">
        Error: {error.message}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <div className="mb-8 rounded-sm border border-stroke bg-white p-8 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-black dark:text-white">
              Welcome back, {user?.name}
            </h1>
            <p className="mt-2 text-body-color dark:text-bodydark">
              Your customer account is now connected to the new role-aware app flow.
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary">
            {user?.role}
          </span>
        </div>

        <div className="grid gap-4 text-sm text-body-color dark:text-bodydark md:grid-cols-2">
          <div>
            <div className="font-medium text-black dark:text-white">Name</div>
            <div>{user?.name}</div>
          </div>
          <div>
            <div className="font-medium text-black dark:text-white">Email</div>
            <div>{user?.email}</div>
          </div>
          <div>
            <div className="font-medium text-black dark:text-white">Account Type</div>
            <div>{user?.title || "Customer"}</div>
          </div>
          <div>
            <div className="font-medium text-black dark:text-white">User ID</div>
            <div>#{user?.id}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Link
          to="/arenas"
          className="rounded-sm border border-stroke bg-white p-6 shadow-default transition hover:border-primary dark:border-strokedark dark:bg-boxdark"
        >
          <h2 className="mb-2 text-xl font-semibold text-black dark:text-white">
            Browse Arenas
          </h2>
          <p className="text-sm text-body-color dark:text-bodydark">
            Explore available venues and start a new booking.
          </p>
        </Link>

        <Link
          to="/bookings"
          className="rounded-sm border border-stroke bg-white p-6 shadow-default transition hover:border-primary dark:border-strokedark dark:bg-boxdark"
        >
          <h2 className="mb-2 text-xl font-semibold text-black dark:text-white">
            Manage Bookings
          </h2>
          <p className="text-sm text-body-color dark:text-bodydark">
            Look up, edit, or cancel your current reservations.
          </p>
        </Link>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => {
            clearStoredAuth();
            navigate("/auth/signin");
          }}
          className="rounded-lg border border-red-300 px-5 py-3 text-sm font-medium text-red-600"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
