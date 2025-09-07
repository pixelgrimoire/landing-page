export default function FeatureCard({ title, children, icon }: { title: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="glass border border-white/10 rounded-2xl p-6 pixel-border h-full">
      <div className="text-2xl mb-3">{icon}</div>
      <h3 className="text-white font-semibold mb-2 smooth-font">{title}</h3>
      <p className="text-white/75 text-sm leading-relaxed smooth-font">{children}</p>
    </div>
  );
}

