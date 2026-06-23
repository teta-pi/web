"use client";

interface PrivacyToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

export function PrivacyToggle({ label, description, value, onChange, disabled }: PrivacyToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        background: "none",
        border: "none",
        padding: "10px 0",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        gap: 16,
      }}
    >
      <span style={{ textAlign: "left" }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
          {label}
        </span>
        {description && (
          <span style={{ display: "block", fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>
            {description}
          </span>
        )}
      </span>

      {/* Track */}
      <span
        style={{
          flexShrink: 0,
          position: "relative",
          display: "inline-block",
          width: 36,
          height: 20,
          borderRadius: 10,
          background: value ? "#6B3FA0" : "var(--color-border-secondary)",
          transition: "background 0.15s",
        }}
      >
        {/* Thumb */}
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.15s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }}
        />
      </span>
    </button>
  );
}
