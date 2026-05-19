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
      <h1>Tu profesor privado de inglés con voz, avatar visual y XP.</h1>
      <p>
        Entrá a una clase premium con voz en tiempo real, avatar visual seguro,
        corrección visible y progreso con XP solo cuando hubo práctica real y
        feedback verificado.
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
        Entrar a la clase premium
      </Link>
    </main>
  );
}
