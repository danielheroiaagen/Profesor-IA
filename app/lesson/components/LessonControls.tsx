import type { RaioSpeakingLesson } from "@/domain/raio-curriculum";

import type { TutorStageViewModel } from "./AvatarStage";

type LessonStatus =
  | "idle"
  | "starting"
  | "active"
  | "feedback"
  | "completed"
  | "failed";

type LessonSession = {
  id: string;
  state: string;
  startedAt: string;
  metrics: {
    learnerTurns: number;
    feedbackEvents: number;
  };
};

function formatStartLessonAction(status: LessonStatus): string {
  if (status === "starting") return "Preparando clase...";
  if (status === "active" || status === "feedback") return "Clase abierta";
  if (status === "completed") return "Practicar otra vez";
  if (status === "failed") return "Reintentar clase";

  return "Empezar clase";
}

function formatCompleteLessonAction(
  status: LessonStatus,
  hasLesson: boolean,
  hasCompletionEvidence: boolean,
): string {
  if (status === "completed") return "Clase cerrada";
  if (status === "failed") return "Reintento necesario";
  if (hasLesson && !hasCompletionEvidence) return "Esperando evidencia de voz";

  return "Finalizar clase";
}

interface LessonControlsProps {
  lessonPlan: RaioSpeakingLesson;
  status: LessonStatus;
  lesson: LessonSession | null;
  startControlsDisabled: boolean;
  practiceControlsDisabled: boolean;
  canCompleteLesson: boolean;
  hasCompletionEvidence: boolean;
  completionHint: string;
  currentStateIcon: string;
  stage: Pick<
    TutorStageViewModel,
    "motionCue" | "stateLabel" | "stateDescription"
  >;
  onStartLesson: () => void;
  onRecordLearnerTurn: () => void;
  onRecordVisibleFeedback: () => void;
  onCompleteLesson: () => void;
}

export function LessonControls({
  lessonPlan,
  status,
  lesson,
  startControlsDisabled,
  practiceControlsDisabled,
  canCompleteLesson,
  hasCompletionEvidence,
  completionHint,
  currentStateIcon,
  stage,
  onStartLesson,
  onRecordLearnerTurn,
  onRecordVisibleFeedback,
  onCompleteLesson,
}: LessonControlsProps) {
  return (
    <div className="lessonHeroActions">
      {/* Practice phrase + start button */}
      <section
        id="practice-controls"
        className="controlDock controlDock--hero"
        aria-label="Controles de clase"
      >
        <div className="targetPrompt">
          <p className="targetIntro">Practicá diciendo:</p>
          <h1 id="lesson-title">
            Clase RAIO A1: escuchá en español, respondé en inglés.
          </h1>
          <p className="targetInstruction">{lessonPlan.spanishInstruction}</p>
          <p className="targetPhrase">
            {"“"}
            {lessonPlan.targetEnglish}
            {"”"}
          </p>
          <p className="targetSupport">{lessonPlan.pronunciationHint}</p>
        </div>
        <div className="startPanel">
          <span>Clase guiada por voz</span>
          <button
            className="primaryButton startLessonButton"
            type="button"
            onClick={onStartLesson}
            disabled={startControlsDisabled}
          >
            <span aria-hidden="true">▷</span>
            {formatStartLessonAction(status)}
          </button>
        </div>
        <div className="controlActions">
          <button
            className="secondaryButton"
            type="button"
            onClick={onRecordLearnerTurn}
            disabled={practiceControlsDisabled}
          >
            <span aria-hidden="true">🎙</span>
            Ya practiqué la frase
          </button>
          <button
            className="secondaryButton"
            type="button"
            onClick={onRecordVisibleFeedback}
            disabled={practiceControlsDisabled}
          >
            <span aria-hidden="true">✦</span>
            Ver corrección sugerida
          </button>
          <button
            className="dangerButton"
            type="button"
            onClick={onCompleteLesson}
            disabled={!canCompleteLesson}
          >
            <span aria-hidden="true">×</span>
            {formatCompleteLessonAction(
              status,
              Boolean(lesson),
              hasCompletionEvidence,
            )}
          </button>
        </div>
        <p className="controlHint">{completionHint}</p>
      </section>

      {/* Single status chip - sits below CTA in right column */}
      <div
        className={`tutorStatusBar tutorStatusBar--${stage.motionCue}`}
        aria-label="Estado actual del tutor"
        aria-live="polite"
      >
        <span className="tutorStatusDot" aria-hidden="true" />
        <span className="tutorStatusIcon" aria-hidden="true">
          {currentStateIcon}
        </span>
        <span className="tutorStatusLabel">{stage.stateLabel}</span>
        <span className="tutorStatusDesc">{stage.stateDescription}</span>
      </div>
    </div>
  );
}
