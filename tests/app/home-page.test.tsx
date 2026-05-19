// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/../app/page";

describe("HomePage", () => {
  it("presents the premium private tutor promise without MVP/debug wording", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        name: "Tu profesor privado de inglés con voz, avatar visual y XP.",
      }),
    ).toBeVisible();
    expect(screen.getByText(/corrección visible/i)).toBeVisible();
    expect(screen.getByText(/progreso con XP/i)).toBeVisible();
    expect(screen.queryByText(/MVP/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Entrar a la clase premium" }),
    ).toHaveAttribute("href", "/lesson");
  });
});
