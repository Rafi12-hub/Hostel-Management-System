import React from "react";

interface QRCodeProps {
  value: string;
  size?: number;
  alt?: string;
  className?: string;
}

export const QRCode: React.FC<QRCodeProps> = ({
  value,
  size = 160,
  alt = "QR Code",
  className = "",
}) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    value || "RGMCET"
  )}&color=0f172a&bgcolor=ffffff`;

  return (
    <div className={`inline-flex flex-col items-center rounded-xl bg-white p-3 border border-slate-200 shadow-sm ${className}`}>
      <img
        src={qrUrl}
        alt={alt}
        width={size}
        height={size}
        className="rounded-lg object-contain"
        loading="lazy"
      />
      <span className="mt-2 text-[10px] font-mono tracking-tight text-slate-500 max-w-[160px] truncate">
        {value}
      </span>
    </div>
  );
};
