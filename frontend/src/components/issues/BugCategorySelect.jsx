import { useMemo } from "react";
import Select from "react-select";
import {
  filterBugCategoryOption,
  getBugCategoryDescription,
  getBugCategorySelectGroups,
} from "@/lib/issues";

const SELECT_MENU_MAX_HEIGHT = 280;

const categorySelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 12,
    borderColor: state.isFocused ? "rgba(59, 130, 246, 0.48)" : "#dbe2ea",
    backgroundColor: "#ffffff",
    boxShadow: state.isFocused
      ? "0 0 0 2px rgba(59, 130, 246, 0.12)"
      : "0 1px 2px rgba(15, 23, 42, 0.04)",
    "&:hover": {
      borderColor: state.isFocused ? "rgba(59, 130, 246, 0.48)" : "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "2px 12px",
  }),
  input: (base) => ({
    ...base,
    color: "#0f172a",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#94a3b8",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    color: state.isFocused ? "#2563eb" : "#64748b",
    "&:hover": {
      color: "#2563eb",
    },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 40px -24px rgba(15, 23, 42, 0.28)",
    marginTop: 6,
    zIndex: 50,
  }),
  menuList: (base) => ({
    ...base,
    padding: 6,
    maxHeight: SELECT_MENU_MAX_HEIGHT,
  }),
  groupHeading: (base) => ({
    ...base,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#64748b",
    marginBottom: 4,
    padding: "8px 10px 4px",
  }),
  option: (base, state) => ({
    ...base,
    borderRadius: 10,
    padding: "8px 10px",
    backgroundColor: state.isSelected
      ? "rgba(219, 234, 254, 0.92)"
      : state.isFocused
        ? "rgba(248, 250, 252, 0.96)"
        : "transparent",
    color: "#0f172a",
    cursor: "pointer",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#0f172a",
    fontSize: 14,
  }),
};

const formatCategoryOptionLabel = (option, { context }) => {
  if (context === "value") {
    return <span className="truncate text-sm text-slate-900">{option.label}</span>;
  }

  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-slate-900">{option.label}</p>
      {(option.description || option.data?.description) ? (
        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">
          {option.description || option.data?.description}
        </p>
      ) : null}
    </div>
  );
};

const formatGroupLabel = (group) => (
  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
    {group.label}
  </span>
);

const BugCategorySelect = ({ value = "", onChange, isDisabled = false, inputId }) => {
  const options = useMemo(() => getBugCategorySelectGroups(value), [value]);

  const selectedOption = useMemo(() => {
    if (!value) {
      return null;
    }

    for (const group of options) {
      const match = group.options.find((option) => option.value === value);

      if (match) {
        return match;
      }
    }

    return {
      value,
      label: value,
      description: getBugCategoryDescription(value),
    };
  }, [options, value]);

  return (
    <Select
      inputId={inputId}
      options={options}
      value={selectedOption}
      onChange={(option) => onChange(option?.value || "")}
      styles={categorySelectStyles}
      formatOptionLabel={formatCategoryOptionLabel}
      formatGroupLabel={formatGroupLabel}
      filterOption={filterBugCategoryOption}
      isSearchable
      isClearable
      isDisabled={isDisabled}
      placeholder="Select category"
      noOptionsMessage={() => "No categories match your search."}
      classNamePrefix="bug-category"
      menuPlacement="auto"
      maxMenuHeight={SELECT_MENU_MAX_HEIGHT}
    />
  );
};

export default BugCategorySelect;
