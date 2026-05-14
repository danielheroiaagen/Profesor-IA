// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/../app/page";

describe("HomePage", () => {
  it("presents the speaking class without MVP/debug wording", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        name: "Practicá inglés con una clase corta por voz.",
      }),
    ).toBeVisible();
    expect(screen.getByText(/sesión de voz en tiempo real/i)).toBeVisible();
    expect(screen.queryByText(/MVP/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Empezar clase de speaking" }),
    ).toHaveAttribute("href", "/lesson");
  });
});
