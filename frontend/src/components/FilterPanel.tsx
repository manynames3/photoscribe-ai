import type { SearchFilters } from "../types";

type FilterPanelProps = {
  disabled?: boolean;
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onClear: () => void;
};

const FILTER_GROUPS = [
  {
    key: "mood",
    label: "Tone",
    options: ["confident", "serene", "energetic", "neutral", "dramatic"],
  },
  {
    key: "scene_type",
    label: "Photo type",
    options: ["portrait", "event", "documentary", "architectural", "interior"],
  },
  {
    key: "lighting",
    label: "Lighting",
    options: ["studio", "soft_diffused", "mixed", "low_light"],
  },
] as const;

export function FilterPanel({ disabled = false, filters, onChange, onClear }: FilterPanelProps) {
  return (
    <div className="filter-stack">
      {FILTER_GROUPS.map((group) => (
        <section key={group.key}>
          <label>
            <span>{group.label}</span>
            <select disabled={disabled} value={filters[group.key] ?? ""}
              onChange={(event) => onChange({ ...filters, [group.key]: event.target.value || undefined })}>
              <option value="">All {group.label.toLowerCase()}</option>
              {group.options.map((option) => <option key={option} value={option}>{option.replace(/_/g, " ")}</option>)}
            </select>
          </label>
        </section>
      ))}

      <button className="clear-filters" disabled={disabled} onClick={onClear} type="button">
        Clear filters
      </button>
    </div>
  );
}
