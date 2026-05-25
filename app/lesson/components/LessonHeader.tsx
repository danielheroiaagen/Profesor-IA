interface LessonHeaderProps {
  totalXp: number;
}

export function LessonHeader({ totalXp }: LessonHeaderProps) {
  return (
    <header className="classroomTopbar" aria-label="Profesor IA lesson header">
      <p className="brandMark">Profesor IA</p>
      <nav className="classroomNav" aria-label="Secciones de clase">
        <ul>
          <li>
            <a aria-current="page" href="#lesson-stage">
              Clase
            </a>
          </li>
          <li>
            <a href="#practice-controls">Práctica</a>
          </li>
          <li>
            <a href="#progress-panel">Progreso</a>
          </li>
          <li>
            <a href="#session-status">Estado</a>
          </li>
        </ul>
      </nav>
      <div className="topbarActions" aria-label="Progreso y perfil">
        <p className="streakPill" aria-label="Racha de 7 días">
          <span aria-hidden="true">◌</span> 7
        </p>
        <p className="xpPill" aria-label={`${totalXp} XP guardados`}>
          ✦ {totalXp} XP
        </p>
        <span className="profileOrb" aria-label="Perfil de estudiante">
          IA
        </span>
      </div>
    </header>
  );
}
