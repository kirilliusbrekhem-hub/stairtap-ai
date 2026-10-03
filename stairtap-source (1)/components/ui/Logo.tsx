import Image from "next/image";

export function Logo({ height = 26 }: { height?: number }) {
  return <Image src="/logo.png" alt="STAIRTAP" width={Math.round((height * 847) / 288)} height={height} priority style={{ height, width: "auto" }} />;
}

/** Arrow mark derived from the STAIRTAP wordmark: slanted stroke + leaning shaft + solid head. */
export function SendMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      <path d="M9 28.8L13.4 7.6" stroke="currentColor" strokeWidth="3.2" fill="none" />
      <path d="M21.2 13.2L22.7 28.8" stroke="currentColor" strokeWidth="3.2" fill="none" />
      <path d="M19.4 2.2L27.6 14.4L14.6 15Z" fill="currentColor" />
    </svg>
  );
}
