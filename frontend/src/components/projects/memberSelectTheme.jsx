import { getInitials } from "@/lib/utils";

export const buildMemberOption = (user) => ({
  value: user._id,
  label: user.name,
  email: user.email,
  role: user.role,
});

export const memberSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 58,
    borderRadius: 24,
    borderColor: state.isFocused
      ? "rgba(59, 130, 246, 0.38)"
      : "rgba(148, 163, 184, 0.2)",
    background: state.isDisabled
      ? "rgba(248, 250, 252, 0.8)"
      : "rgba(255, 255, 255, 0.82)",
    boxShadow: state.isFocused
      ? "0 0 0 4px rgba(59, 130, 246, 0.12), 0 16px 32px -24px rgba(15, 23, 42, 0.4)"
      : "0 16px 32px -24px rgba(15, 23, 42, 0.28)",
    paddingLeft: 8,
    paddingRight: 8,
    backdropFilter: "blur(14px)",
    transition: "all 180ms ease",
    "&:hover": {
      borderColor: "rgba(59, 130, 246, 0.32)",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    gap: 6,
    paddingTop: 8,
    paddingBottom: 8,
  }),
  placeholder: (base) => ({
    ...base,
    color: "#64748b",
  }),
  input: (base) => ({
    ...base,
    color: "#0f172a",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "#2563eb" : "#64748b",
    transition: "color 180ms ease",
    "&:hover": {
      color: "#2563eb",
    },
  }),
  clearIndicator: (base) => ({
    ...base,
    color: "#94a3b8",
    "&:hover": {
      color: "#475569",
    },
  }),
  menu: (base) => ({
    ...base,
    overflow: "hidden",
    borderRadius: 24,
    border: "1px solid rgba(226, 232, 240, 0.85)",
    background: "rgba(255, 255, 255, 0.92)",
    boxShadow: "0 28px 60px -30px rgba(15, 23, 42, 0.45)",
    backdropFilter: "blur(18px)",
  }),
  menuList: (base) => ({
    ...base,
    maxHeight: 260,
    padding: 8,
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: 18,
    padding: "12px 14px",
    background: state.isSelected
      ? "linear-gradient(135deg, rgba(96, 165, 250, 0.18), rgba(99, 102, 241, 0.18))"
      : state.isFocused
        ? "rgba(241, 245, 249, 0.95)"
        : "transparent",
    color: "#0f172a",
    cursor: "pointer",
    transition: "background 180ms ease, transform 180ms ease",
  }),
  multiValue: (base) => ({
    ...base,
    alignItems: "center",
    gap: 4,
    borderRadius: 9999,
    border: "1px solid rgba(191, 219, 254, 0.95)",
    background:
      "linear-gradient(135deg, rgba(239, 246, 255, 0.98), rgba(224, 231, 255, 0.94))",
    paddingLeft: 4,
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: "#1e3a8a",
    fontSize: 13,
    fontWeight: 600,
    padding: "4px 0 4px 4px",
  }),
  multiValueRemove: (base) => ({
    ...base,
    borderRadius: 9999,
    color: "#1d4ed8",
    transition: "all 180ms ease",
    "&:hover": {
      background: "rgba(191, 219, 254, 0.95)",
      color: "#1e40af",
    },
  }),
  noOptionsMessage: (base) => ({
    ...base,
    color: "#64748b",
    padding: "12px 16px",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#0f172a",
    fontWeight: 600,
  }),
};

export const formatMemberOptionLabel = (option, { context }) => {
  if (context !== "menu") {
    return option.label;
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-gradient-to-br from-sky-100 to-indigo-100 text-xs font-semibold text-slate-700 shadow-sm">
        {getInitials(option.label)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {option.label}
        </p>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
            {option.role}
          </span>
          <span className="truncate">{option.email}</span>
        </div>
      </div>
    </div>
  );
};
