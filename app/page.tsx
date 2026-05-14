import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: "760px",
        padding: "4rem 1.5rem",
        fontFamily: "system-ui",
      }}
    >
      <p
        style={{
          color: "#2563eb",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Profesor IA
      </p>
      <h1>Practicá inglés con una clase corta por voz.</h1>
      <p>
        La clase arranca una sesión de voz en tiempo real con credenciales
        efímeras, muestra correcciones visibles y otorga XP solo cuando hubo
        participación real y feedback.
      </p>
      <Link
        href="/lesson"
        style={{
          display: "inline-block",
          marginTop: "1rem",
          borderRadius: "999px",
          background: "#111827",
          color: "white",
          padding: "0.8rem 1.1rem",
          textDecoration: "none",
        }}
      >
        Empezar clase de speaking
      </Link>
    </main>
  );
}
