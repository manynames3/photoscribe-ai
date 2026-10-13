import type { RefObject } from "react";

type SearchBarProps = {
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: (query: string) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  value: string;
};

export function SearchBar({
  disabled = false,
  onChange,
  onSubmit,
  searchInputRef,
  value,
}: SearchBarProps) {
  return (
    <form
      className="search-form"
      aria-busy={disabled}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <div className="search-bar">
        <input
          aria-label="Search photos"
          className="search-input"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search approved photos, people, locations, or events"
          ref={searchInputRef}
          value={value}
        />
        <button className="search-button" disabled={disabled} type="submit">
          {disabled ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
  );
}
