// Companion sentence that translates a technical feature explainer into
// plain language for users who don't speak Canadian tax / quant-finance.
// Always-visible, sits directly under the technical sentence — no label
// prefix, just lighter/italic to read as a casual follow-on.
export default function PlainEnglish({ children }) {
  return (
    <p className="text-[11px] text-muted-foreground/70 italic mt-1 leading-snug">
      {children}
    </p>
  );
}
