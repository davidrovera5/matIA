export default function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-5xl" : size === "md" ? "text-3xl" : "text-xl";
  return (
    <span className={`${text} font-black tracking-tight`}>
      <span className="text-[#f0ebe5]">mat</span>
      <span className="text-yerba-500">IA</span>
      <span className="text-yerba-400 ml-1.5 text-[0.7em]">🧉</span>
    </span>
  );
}
