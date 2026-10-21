// An odometer figure: every digit is a vertical strip that rolls to its
// value. The first paint renders the
// target digits directly, so nothing is hidden before hydration, and
// every later change rolls.
export default function Odometer({
  value,
  className = "",
}: {
  value: string;
  className?: string;
}) {
  const chars = String(value).split("");
  return (
    <span className={"odometer " + className} aria-label={value}>
      {chars.map((ch, i) =>
        /[0-9]/.test(ch) ? (
          <span className="odo-digit" key={i} aria-hidden="true">
            <span
              className="odo-strip"
              style={{ transform: `translateY(-${Number(ch)}em)` }}
            >
              {["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span className="odo-char" key={i} aria-hidden="true">
            {ch}
          </span>
        )
      )}
    </span>
  );
}
