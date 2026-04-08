import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline";
};

export function Button({ className = "", variant = "default", children, ...props }: Props) {
  return (
    <button
      className={`${variant === "outline" ? "btn-outline" : "btn"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
