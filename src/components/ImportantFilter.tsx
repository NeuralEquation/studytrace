export function ImportantFilter({
  value,
  onChange,
  onlyLabel = "重要問題のみ",
  allLabel = "すべての問題",
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  onlyLabel?: string;
  allLabel?: string;
}) {
  return (
    <div className="actions" aria-label="問題の表示範囲">
      <button
        type="button"
        className={value ? "" : "secondary"}
        aria-pressed={value}
        onClick={() => onChange(true)}
      >
        {onlyLabel}
      </button>
      <button
        type="button"
        className={value ? "secondary" : ""}
        aria-pressed={!value}
        onClick={() => onChange(false)}
      >
        {allLabel}
      </button>
    </div>
  );
}
