const resolveUserRole = (user) => {
  if (user?.role) {
    return user.role;
  }

  const normalizedTitle = user?.title?.toLowerCase() ?? "";

  if (normalizedTitle.includes("admin")) {
    return "admin";
  }

  if (
    normalizedTitle.includes("operator") ||
    normalizedTitle.includes("manager") ||
    normalizedTitle.includes("staff")
  ) {
    return "operator";
  }

  return "customer";
};

module.exports = {
  resolveUserRole,
};
