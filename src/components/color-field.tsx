"use client";

import { useRef, useState } from "react";

/**
 * Brand colour input: a native colour picker and a hex text field kept in sync.
 * The hidden input named `brandColor` is what the server action reads.
 */
export function ColorField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue.toUpperCase());
  const textRef = useRef<HTMLInputElement>(null);

  const isValid = /^#[0-9A-Fa-f]{6}$/.test(value);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label="Brand colour picker"
        value={isValid ? value : defaultValue}
        onChange={(event) => {
          setValue(event.target.value.toUpperCase());
          if (textRef.current) textRef.current.value = event.target.value.toUpperCase();
        }}
        className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1"
      />
      <input
        ref={textRef}
        id="brandColor"
        name="brandColor"
        value={value}
        onChange={(event) => setValue(event.target.value.toUpperCase())}
        pattern="#[0-9A-Fa-f]{6}"
        title="Hex colour, e.g. #2F6BFF"
        className="field font-mono text-[12.5px] uppercase"
        maxLength={7}
      />
    </div>
  );
}
