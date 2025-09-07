export default function Tech() {
  const tech = ['Next.js','React','Tailwind','FastAPI','C#','PostgreSQL','MongoDB','Redis','Docker','Cloudflare','Vercel'];
  return (
    <section className="relative py-16" id="tech">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-white text-2xl sm:text-3xl font-bold mb-6 smooth-font">Tecnologías</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {tech.map((t)=> (
            <div key={t} className="glass border border-white/10 rounded-xl px-3 py-3 text-center text-white/90 pixel-font text-[11px] tracking-wider fade-up">{t}</div>
          ))}
        </div>
      </div>
    </section>
  );
}

