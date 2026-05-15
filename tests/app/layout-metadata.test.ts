import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-body" }),
  Space_Grotesk: () => ({ variable: "font-display" }),
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
