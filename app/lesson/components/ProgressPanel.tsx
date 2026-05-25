import type { RaioSpeakingLesson } from "@/domain/raio-curriculum";

type XPResult = {
  awarded: boolean;
  xp: number;
  reason: string;
};

interface ProgressPanelProps {
  xp: XPResult | null;
  totalXp: number;
  learnerTurns: number;
  feedbackEvents: number;
  feedbackSummary: string;
  lessonPlan: RaioSpeakingLesson;
}

export function ProgressPanel({
  xp,
  totalXp,
  learnerTurns,
  feedbackEvents,
  feedbackSummary,
  lessonPlan,
}: ProgressPanelProps) {
  return (
    <section
      id="progress-panel"
      className="progressCard"
      aria-labelledby="progress-title"
    >
      <div className="cardTitleRow">
        <h2 id="progress-title">Progreso de Sesión</h2>
        <span>+{xp?.awarded ? xp.xp : 0} XP ganado</span>
      </div>
      <div className="xpScoreLine">
        <span>Total XP</span>
        <strong>
          {totalXp}
          <small>/500</small>
        </strong>
      </div>
      <div className="progressTrack" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (totalXp / 500) * 100)}%` }} />
      </div>
      <div className="statGrid" aria-label="Evidencia de sesión">
        <article>
          <span>Turnos</span>
          <strong>{learnerTurns} / 10</strong>
        </article>
        <article>
          <span>Feedback</span>
          <strong>{feedbackEvents}</strong>
        </article>
      </div>
      <div className="activityList">
        <p>Actividad Reciente</p>
        <div>
          <span aria-hidden="true">✓</span>
          <strong>Corrección visible</strong>
          <small>{feedbackSummary}</small>
        </div>
        <div>
          <span aria-hidden="true">○</span>
          <strong>Próximo objetivo</strong>
          <small>{lessonPlan.nextGoal}</small>
        </div>
      </div>
    </section>
  );
}
