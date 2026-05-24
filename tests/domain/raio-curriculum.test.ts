import { describe, expect, it } from "vitest";

import {
  buildRaioRealtimeOpeningInstructions,
  buildRaioRealtimeTutorInstructions,
  getDefaultRaioSpeakingLesson,
} from "@/domain/raio-curriculum";

describe("RAIO curriculum", () => {
  it("provides the first bilingual speaking drill from the RAIO notebook", () => {
    const lesson = getDefaultRaioSpeakingLesson();

    expect(lesson).toMatchObject({
      method: "RAIO/YouTalk",
      level: "A1",
      sourceNotebook: "Currículo Integral RAIO de Inglés",
      spanishInstruction: "Decí en inglés: «Es un libro.»",
      targetEnglish: "It's a book.",
    });
    expect(lesson.visibleFeedback).toContain("no “is a book”");
  });

  it("builds Spanish tutor instructions for English oral output", () => {
    const instructions = buildRaioRealtimeTutorInstructions(
      getDefaultRaioSpeakingLesson(),
    );

    expect(instructions).toContain("Speak to the learner in Spanish");
    expect(instructions).toContain("It's a book.");
    expect(instructions).toContain("Correct the learner's actual last spoken");
    expect(instructions).toContain("visual avatar in the UI is passive");
  });

  it("builds a spoken Spanish opening that asks for the English phrase", () => {
    const instructions = buildRaioRealtimeOpeningInstructions(
      getDefaultRaioSpeakingLesson(),
    );

    expect(instructions).toContain("Start the lesson now in spoken Spanish");
    expect(instructions).toContain("Tu frase de hoy es: Es un libro.");
    expect(instructions).toContain("It's a book.");
    expect(instructions).toContain("Then stop speaking and listen");
  });
});
