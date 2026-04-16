import { Link } from "react-router-dom";

const Landing = () => {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4.75rem)] max-w-5xl flex-col justify-center px-6 py-16">
      <div className="max-w-2xl">
        <span className="mb-4 inline-flex rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary">
          Cross Courts
        </span>
        <h1 className="mb-4 text-4xl font-bold text-black dark:text-white">
          Multi-arena booking is now split into public, operator, and admin
          experiences.
        </h1>
        <p className="mb-8 text-base text-body-color dark:text-bodydark">
          Phase 1 introduces role-aware routing so the existing dashboard can
          grow into operator and admin workspaces while public browsing routes
          are added in parallel.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            to="/arenas"
            className="rounded-lg bg-primary px-5 py-3 font-medium text-white"
          >
            Browse Arenas
          </Link>
          <Link
            to="/auth/signin"
            className="rounded-lg border border-stroke px-5 py-3 font-medium text-black dark:border-strokedark dark:text-white"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Landing;
