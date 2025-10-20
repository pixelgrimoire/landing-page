'use client';

type Props = { className?: string };

export default function PasswordHint({ className = '' }: Props) {
  return (
    <p className={"text-xs text-white/60 mt-2 " + className}>
      Contraseña: mínimo 8 caracteres. Se permiten letras, números y símbolos comunes. Evita espacios y emojis. Si falla con acentos, usa solo caracteres ASCII. Nota: aunque el medidor indique que la contraseña cumple los requisitos, no se aceptarán contraseñas comprometidas (detectadas en brechas conocidas).
    </p>
  );
}
