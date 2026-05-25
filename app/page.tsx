import Link from "next/link";

const features = [
  {
    title: "Voz en tiempo real",
    desc: "Hablás y el tutor te responde al instante. Practicás speaking de verdad, no tipeando.",
  },
  {
    title: "Avatar visual seguro",
    desc: "Presencia visual del profesor con fallback honesto: nunca prometemos lo que no se puede cumplir.",
  },
  {
    title: "XP con evidencia",
    desc: "Sumás progreso solo cuando hubo práctica real y feedback verificado. Sin premios vacíos.",
  },
];

export default function HomePage() {
  return (
    <main className="home">
      <section className="hero">
        <p className="eyebrow">Profesor IA</p>
        <h1 className="hero__title">
          Tu profesor privado de inglés con voz, avatar visual y XP.
        </h1>
        <p className="hero__lead">
          Entrá a una clase premium con voz en tiempo real, avatar visual
          seguro, corrección visible y progreso con XP solo cuando hubo práctica
          real y feedback verificado.
        </p>
        <div className="hero__actions">
          <Link href="/lesson" className="btn btn-primary">
            Entrar a la clase premium
            <span aria-hidden="true">→</span>
          </Link>
          <a href="#como-funciona" className="btn btn-ghost">
            Cómo funciona
          </a>
        </div>
      </section>

      <section
        id="como-funciona"
        className="features"
        aria-label="Cómo funciona la clase"
      >
        <ul className="features__list">
          {features.map((feature) => (
            <li key={feature.title} className="feature">
              <h2 className="feature__title">{feature.title}</h2>
              <p className="feature__desc">{feature.desc}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
