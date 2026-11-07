import happy1024 from "../assets/mascot/mascot-happy-1024.webp";
import happy512 from "../assets/mascot/mascot-happy-512.webp";
import happyPng from "../assets/mascot/mascot-happy-512.png";
import idle1024 from "../assets/mascot/mascot-idle-1024.webp";
import idle512 from "../assets/mascot/mascot-idle-512.webp";
import idlePng from "../assets/mascot/mascot-idle-512.png";
import sad1024 from "../assets/mascot/mascot-sad-1024.webp";
import sad512 from "../assets/mascot/mascot-sad-512.webp";
import sadPng from "../assets/mascot/mascot-sad-512.png";

export type Mood = "idle" | "happy" | "sad";

const ART: Record<Mood, { small: string; large: string; fallback: string }> = {
  idle: { small: idle512, large: idle1024, fallback: idlePng },
  happy: { small: happy512, large: happy1024, fallback: happyPng },
  sad: { small: sad512, large: sad1024, fallback: sadPng },
};

const ALT: Record<Mood, string> = {
  idle: "Swarmpad mascot floating with its antenna up",
  happy: "Swarmpad mascot with both arms raised",
  sad: "Swarmpad mascot with its antenna bent",
};

export function Mascot({
  mood = "idle",
  size = 512,
  className = "",
  decorative = false,
}: {
  mood?: Mood;
  size?: number;
  className?: string;
  decorative?: boolean;
}) {
  const art = ART[mood];
  return (
    <picture className={`mascot ${className}`.trim()}>
      <source
        type="image/webp"
        srcSet={`${art.small} 512w, ${art.large} 1024w`}
        sizes={`(max-width: 760px) 50vw, ${size}px`}
      />
      <img
        src={art.fallback}
        width={size}
        height={size}
        alt={decorative ? "" : ALT[mood]}
        aria-hidden={decorative || undefined}
        loading={decorative ? "lazy" : "eager"}
        fetchPriority={decorative ? "low" : "high"}
        decoding="async"
      />
    </picture>
  );
}
