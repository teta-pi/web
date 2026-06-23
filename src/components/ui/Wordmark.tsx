"use client";
import Link from "next/link";

interface WordmarkProps {
  size?: "sm" | "lg";
  className?: string;
}

export function Wordmark({ size = "sm", className = "" }: WordmarkProps) {
  const sizes =
    size === "lg"
      ? { theta: 64, plus: 40, pi: 58, gap: 12, letterSpacing: "-2px" }
      : { theta: 20, plus: 15, pi: 18, gap: 7, letterSpacing: "-0.5px" };

  return (
    <Link
      href="/"
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: sizes.gap,
        textDecoration: "none",
        userSelect: "none",
      }}
      className={className}
    >
      <span
        style={{
          fontSize: sizes.theta,
          fontWeight: 600,
          color: "#6B3FA0",
          lineHeight: 1,
          letterSpacing: sizes.letterSpacing,
        }}
      >
        Θ
      </span>
      <span
        style={{
          fontSize: sizes.plus,
          fontWeight: 200,
          color: "#1A1035",
          lineHeight: 1,
        }}
      >
        +
      </span>
      <span
        style={{
          fontSize: sizes.pi,
          fontWeight: 600,
          color: "#E8640C",
          lineHeight: 1,
        }}
      >
        π
      </span>
    </Link>
  );
}
