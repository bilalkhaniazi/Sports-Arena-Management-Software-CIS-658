export type UserRole = "admin" | "operator" | "customer";

export interface StoredUser {
  id: number;
  name: string;
  email: string;
  title?: string;
  role?: UserRole;
}

const USER_STORAGE_KEY = "user";
const TOKEN_STORAGE_KEY = "token";

export const inferUserRole = (user?: Partial<StoredUser> | null): UserRole => {
  if (user?.role) {
    return user.role;
  }

  const normalizedTitle = user?.title?.toLowerCase() ?? "";

  if (normalizedTitle.includes("admin")) {
    return "admin";
  }

  if (normalizedTitle.includes("operator") || normalizedTitle.includes("manager")) {
    return "operator";
  }

  return "customer";
};

export const normalizeStoredUser = (
  user?: Partial<StoredUser> | null,
): StoredUser | null => {
  if (!user?.id || !user?.name || !user?.email) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    title: user.title ?? "",
    role: inferUserRole(user),
  };
};

export const getStoredUser = (): StoredUser | null => {
  const rawUser = localStorage.getItem(USER_STORAGE_KEY);

  if (!rawUser) {
    return null;
  }

  try {
    const parsedUser = JSON.parse(rawUser) as Partial<StoredUser>;
    const normalizedUser = normalizeStoredUser(parsedUser);

    if (!normalizedUser) {
      localStorage.removeItem(USER_STORAGE_KEY);
      return null;
    }

    if (parsedUser.role !== normalizedUser.role) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser));
    }

    return normalizedUser;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
};

export const setStoredUser = (user: Partial<StoredUser>) => {
  const normalizedUser = normalizeStoredUser(user);

  if (!normalizedUser) {
    return;
  }

  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser));
};

export const clearStoredAuth = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
};

export const getDefaultRouteForRole = (role: UserRole) => {
  switch (role) {
    case "admin":
      return "/admin";
    case "customer":
      return "/profile";
    case "operator":
    default:
      return "/operator";
  }
};

export const getCurrentUserRole = (): UserRole | null => {
  const user = getStoredUser();
  return user?.role ?? null;
};
