import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Bricolage_Grotesque: () => ({ variable: "font-display-src" }),
  Hanken_Grotesk: () => ({ variable: "font-body-src" }),
}));

import { metadata } from "@/../app/layout";

describe("Root metadata", () => {
  it("uses product-facing metadata without MVP/debug wording", () => {
    expect(metadata.title).toBe("Profesor IA");
    expect(metadata.description).toBe(
      "Clase corta de inglés por voz con tutor IA y feedback visible.",
    );
    expect(String(metadata.description)).not.toMatch(/MVP|debug/i);
  });
});
