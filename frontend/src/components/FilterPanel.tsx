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
    label: "Mood",
    options: ["playful", "serene", "confident", "mysterious", "dramatic"],
  },
  {
    key: "scene_type",
    label: "Scene",
    options: ["portrait", "lifestyle", "abstract", "interior", "landscape"],
  },
  {
    key: "lighting",
    label: "Lighting",
    options: ["golden_hour", "soft_diffused", "studio", "low_light"],
  },
  {
    key: "time_of_day",
    label: "Time",
    options: ["morning", "afternoon", "sunset", "night"],
  },
] as const;

export function FilterPanel({ disabled = false, filters, onChange, onClear }: FilterPanelProps) {
  return (
    <div className="filter-stack">
      {FILTER_GROUPS.map((group) => (
        <section key={group.key}>
          <div className="filter-group-header">
            <h3>{group.label}</h3>
            {filters[group.key] ? <span className="filter-badge">{filters[group.key]}</span> : null}
          </div>
          <div className="filter-pill-row">
            {group.options.map((option) => {
              const isActive = filters[group.key] === option;

              return (
                <button
                  key={option}
                  aria-pressed={isActive}
                  className={`filter-pill${isActive ? " is-active" : ""}`}
                  disabled={disabled}
                  onClick={() => {
                    onChange({
                      ...filters,
                      [group.key]: isActive ? undefined : option,
                    });
                  }}
                  type="button"
                >
                  {option.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <button className="clear-filters" disabled={disabled} onClick={onClear} type="button">
        Clear filters
      </button>
    </div>
  );
}
