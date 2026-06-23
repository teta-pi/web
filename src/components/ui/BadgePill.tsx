interface BadgePillProps {
  text: string;
}

export function BadgePill({ text }: BadgePillProps) {
  return (
    <span className="badge-pill">
      <span style={{ color: "#6B3FA0", fontSize: 11 }}>✓</span>
      {text}
    </span>
  );
}
