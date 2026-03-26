export const AVATARS = [
  { emoji: "🧉", label: "Mate",      anim: "bounce",  speed: "1.2s" },
  { emoji: "🦫", label: "Carpincho", anim: "bounce",  speed: "1.5s" },
  { emoji: "♨️", label: "Termo",     anim: "pulse",   speed: "1.8s" },
  { emoji: "🌿", label: "Yerba",     anim: "pulse",   speed: "2s"   },
  { emoji: "🎸", label: "Guitarra",  anim: "bounce",  speed: "1s"   },
  { emoji: "📚", label: "Libros",    anim: "pulse",   speed: "2.2s" },
];

export type AvatarEmoji = typeof AVATARS[number]["emoji"];
