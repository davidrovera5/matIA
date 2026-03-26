export const AVATARS = [
  { emoji: "🧉", label: "Mate"      },
  { emoji: "🦫", label: "Carpincho" },
  { emoji: "♨️", label: "Termo"     },
  { emoji: "🌿", label: "Yerba"     },
  { emoji: "🎸", label: "Guitarra"  },
  { emoji: "📚", label: "Libros"    },
] as const;

export type AvatarEmoji = typeof AVATARS[number]["emoji"];
