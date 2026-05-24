export type RaioSpeakingLesson = {
  id: string;
  slug: string;
  method: "RAIO/YouTalk";
  level: "A1";
  title: string;
  sourceNotebook: string;
  spanishInstruction: string;
  spanishMeaning: string;
  targetEnglish: string;
  pronunciationHint: string;
  commonMistakes: string[];
  visibleFeedback: string;
  nextGoal: string;
};

export const DEFAULT_RAIO_SPEAKING_LESSON: RaioSpeakingLesson = {
  id: "yt-l1-it-book",
  slug: "raio-youtalk-a1-it-book",
  method: "RAIO/YouTalk",
  level: "A1",
  title: "Pronombre neutro y vocales cortas",
  sourceNotebook: "Currículo Integral RAIO de Inglés",
  spanishInstruction: "Decí en inglés: «Es un libro.»",
  spanishMeaning: "Es un libro.",
  targetEnglish: "It's a book.",
  pronunciationHint:
    "Uní la frase como un bloque corto: it no se omite y book lleva una vocal corta relajada.",
  commonMistakes: [
    "Omitir el sujeto obligatorio it.",
    "Pronunciar it con una i española demasiado marcada.",
    "Pronunciar book como una u larga en vez de una vocal corta y relajada.",
  ],
  visibleFeedback:
    "Corrección RAIO/YouTalk: en inglés necesitás sujeto. Decí “It's a book.”, no “is a book”. Hacé it corto y book con una vocal relajada.",
  nextGoal: "Responder rápido, en voz alta y sin leer la transcripción.",
};

export function getDefaultRaioSpeakingLesson(): RaioSpeakingLesson {
  return { ...DEFAULT_RAIO_SPEAKING_LESSON };
}

export function buildRaioRealtimeTutorInstructions(lesson: RaioSpeakingLesson) {
  return `You are Profesor IA, a warm and direct Spanish-speaking English coach.
Use the RAIO/YouTalk method for one short live speaking drill.

Lesson:
- Source notebook: ${lesson.sourceNotebook}
- Level: ${lesson.level}
- Title: ${lesson.title}
- Spanish instruction to say aloud first: ${lesson.spanishInstruction}
- Target English phrase the learner must say: ${lesson.targetEnglish}
- Spanish meaning: ${lesson.spanishMeaning}
- Pronunciation focus: ${lesson.pronunciationHint}
- Expected correction summary in Spanish: ${lesson.visibleFeedback}

Interaction contract:
1. Speak to the learner in Spanish for instructions, encouragement, and correction.
2. Ask the learner to say only the target phrase in English.
3. Listen to the learner's English answer. Do not ask for long free conversation.
4. Correct the learner's actual last spoken answer, not a generic example. If the learner said the phrase correctly, confirm it in Spanish and ask for one faster repeat.
5. If the answer was wrong, explain briefly in Spanish what you heard wrong, what was missing or mispronounced, and then say the improved English phrase.
6. If you are not confident about the transcription, say in Spanish that you are not sure what you heard and ask the learner to repeat the target phrase.
7. Keep the learner moving: no long grammar lecture, no hidden system/API details.
8. If the learner asks why the grammar works, give a short Spanish reminder: don't over-analyze; repeat the correct chunk aloud.
9. You are the voice tutor. Any visual avatar in the UI is passive and must not be described as owning the microphone or audio.`;
}

export function buildRaioRealtimeOpeningInstructions(
  lesson: RaioSpeakingLesson,
) {
  return `Start the lesson now in spoken Spanish.
Say a short greeting, then say exactly what the learner must do:
"Tu frase de hoy es: ${lesson.spanishMeaning}. Decila en inglés así: ${lesson.targetEnglish}."
Then stop speaking and listen. Do not correct anything until the learner speaks.`;
}
