export default function Footer() {
  return (
    <footer className="py-10 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row gap-3 items-center justify-between text-white/60 text-sm">
        <div className="pixel-font text-[10px]">© {new Date().getFullYear()} PixelGrimoire</div>
        <div className="flex gap-4">
          <a className="hover:text-white" href="https://github.com/pixelgrimoire" target="_blank" rel="noreferrer">GitHub</a>
          <a className="hover:text-white" href="https://linkedin.com/company/pixelgrimoire" target="_blank" rel="noreferrer">LinkedIn</a>
          <a className="hover:text-white" href="https://twitter.com/PixelGrimoireHQ" target="_blank" rel="noreferrer">X/Twitter</a>
        </div>
      </div>
    </footer>
  );
}

