import { useState, useEffect } from "react";

const SPLASH_KEY = "rgmcet_splash_seen";

export default function SplashScreen() {
  const [visible, setVisible] = useState(() => !sessionStorage.getItem(SPLASH_KEY));
  const [phase, setPhase] = useState<"enter" | "exit">("enter");

  useEffect(() => {
    if (!visible) return;

    const exitTimer = setTimeout(() => {
      setPhase("exit");
      sessionStorage.setItem(SPLASH_KEY, "1");
    }, 2600);

    const removeTimer = setTimeout(() => {
      setVisible(false);
    }, 3200);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #312e81 50%, #0f172a 100%)",
        opacity: phase === "exit" ? 0 : 1,
        transition: "opacity 0.6s ease-in-out",
        pointerEvents: phase === "exit" ? "none" : "auto",
      }}
      onTransitionEnd={() => {
        if (phase === "exit") setVisible(false);
      }}
    >
      {/* Radial glow top-left */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: "20%",
          left: "30%",
          width: "40%",
          height: "40%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Radial glow bottom-right */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: "70%",
          left: "80%",
          transform: "translate(-50%, -50%)",
          width: "40%",
          height: "40%",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* Main content stack */}
      <div className="relative flex flex-col items-center gap-0">
        {/* Logo glow halo */}
        <div
          className="absolute rounded-full"
          style={{
            width: "calc(100% + 48px)",
            height: "calc(100% + 48px)",
            top: "-24px",
            left: "-24px",
            background: "rgba(255,255,255,0.1)",
            filter: "blur(30px)",
          }}
        />

        {/* Logo wrapper with idle pulse */}
        <div
          style={{
            animation: "idle-pulse 1.8s ease-in-out infinite",
          }}
        >
          {/* Logo entrance */}
          <img
            src="https://media.base44.com/images/public/6a8e859522d0c3ff1205c51b/40a48d7b6_logo.jpg"
            alt="RGMCET Logo"
            className="relative z-10 object-contain"
            style={{
              width: "clamp(128px, 20vw, 160px)",
              height: "clamp(128px, 20vw, 160px)",
              filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.5))",
              animation: "logo-entrance 0.9s cubic-bezier(0.16,1,0.3,1) forwards",
              opacity: 0,
              transform: "scale(0.5) translateY(20px)",
            }}
          />
        </div>

        {/* Title */}
        <h1
          className="relative z-10 mt-8 text-center font-bold tracking-tight text-white"
          style={{
            fontSize: "clamp(1.5rem, 4vw, 1.875rem)",
            animation: "fade-slide-up 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s forwards",
            opacity: 0,
            transform: "translateY(12px)",
          }}
        >
          RGMCET Hostel Hub
        </h1>

        {/* Subtitle */}
        <p
          className="relative z-10 mt-1.5 text-center font-medium"
          style={{
            fontSize: "clamp(0.75rem, 2vw, 0.875rem)",
            color: "#c7d2fe",
            animation: "fade-in 0.7s cubic-bezier(0.16,1,0.3,1) 0.8s forwards",
            opacity: 0,
          }}
        >
          Rajeev Gandhi Memorial College of Engineering & Technology
        </p>

        {/* Loading bar */}
        <div
          className="relative z-10 mt-10 overflow-hidden rounded-full"
          style={{
            width: "192px",
            height: "4px",
            background: "rgba(255,255,255,0.15)",
            animation: "fade-in 0.5s cubic-bezier(0.16,1,0.3,1) 1s forwards",
            opacity: 0,
          }}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: "50%",
              background: "linear-gradient(90deg, transparent, #a5b4fc, transparent)",
              animation: "sweep 1.4s ease-in-out infinite",
            }}
          />
        </div>

        {/* Tagline */}
        <p
          className="relative z-10 mt-4 text-center uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.25em",
            color: "rgba(165,180,252,0.7)",
            animation: "fade-in 0.5s cubic-bezier(0.16,1,0.3,1) 1.2s forwards",
            opacity: 0,
          }}
        >
          EDUCATION FOR PEACE · ESTD 1995
        </p>
      </div>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes logo-entrance {
          0% { opacity: 0; transform: scale(0.5) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes idle-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes fade-slide-up {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
