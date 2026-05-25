import { useEffect, useRef, type RefObject } from "react";

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
  const submitTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) {
        window.clearTimeout(submitTimeoutRef.current);
      }
    };
  }, []);

  function scheduleSubmit() {
    if (submitTimeoutRef.current) {
      window.clearTimeout(submitTimeoutRef.current);
    }

    submitTimeoutRef.current = window.setTimeout(() => onSubmit(value), 300);
  }

  return (
    <form
      className="search-form"
      onSubmit={(event) => {
        event.preventDefault();
        scheduleSubmit();
      }}
    >
      <div className="search-bar">
        <input
          aria-label="Search photos"
          className="search-input"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search approved photos, people, locations, or events"
          ref={searchInputRef}
          value={value}
        />
        <span className="keyboard-hint">Press / to focus</span>
        <button className="search-button" disabled={disabled} type="submit">
          {disabled ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
  );
}
