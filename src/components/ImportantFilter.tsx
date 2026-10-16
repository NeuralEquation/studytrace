export function ImportantFilter({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="actions" aria-label="問題の表示範囲">
      <button
        type="button"
        className={value ? "" : "secondary"}
        aria-pressed={value}
        onClick={() => onChange(true)}
      >
        重要問題のみ
      </button>
      <button
        type="button"
        className={value ? "secondary" : ""}
        aria-pressed={!value}
        onClick={() => onChange(false)}
      >
        すべての問題
      </button>
    </div>
  );
}
