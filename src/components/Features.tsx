import FeatureCard from '@/components/FeatureCard';

export default function Features() {
  return (
    <section className="relative py-20" id="features">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard title="SaaS y Apps" icon={<span>🧪</span>}>Interfaces con estética retro y rendimiento moderno. PWA, auth, pagos y dashboards listos para producción.</FeatureCard>
          <FeatureCard title="POS encantados" icon={<span>🧷</span>}>Sistemas de punto de venta robustos y bonitos, con hardware, tickets y sincronización offline.</FeatureCard>
          <FeatureCard title="Hechizos Dev" icon={<span>🪄</span>}>Tooling, CI/CD y librerías open‑source para acelerar tus rituales de desarrollo.</FeatureCard>
        </div>
      </div>
    </section>
  );
}

