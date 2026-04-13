"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { buildQrAccessUrl } from "@/lib/secureQr";

type Props = {
  token?: string | null;
  size?: number;
  label?: string | null;
  className?: string;
  frameClassName?: string;
  captionClassName?: string;
  onReady?: () => void;
};

export default function SecureQrCode({
  token,
  size = 120,
  label = null,
  className = "",
  frameClassName = "",
  captionClassName = "",
  onReady,
}: Props) {
  const [origin, setOrigin] = useState("");
  const [svgMarkup, setSvgMarkup] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
  }, []);

  const normalizedToken = String(token ?? "").trim();
  const qrValue = useMemo(() => {
    if (!normalizedToken) return "";
    return buildQrAccessUrl(normalizedToken, origin || undefined);
  }, [normalizedToken, origin]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!qrValue) {
        setSvgMarkup("");
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const svg = await QRCode.toString(qrValue, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 1,
          color: {
            dark: "#111827",
            light: "#FFFFFF",
          },
        });

        if (cancelled) return;
        setSvgMarkup(svg);
        setLoading(false);
        onReady?.();
      } catch {
        if (cancelled) return;
        setSvgMarkup("");
        setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [onReady, qrValue]);

  if (!normalizedToken) return null;

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`.trim()}>
      <div
        className={`overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-[#2a2a3e] ${frameClassName}`.trim()}
        style={{ width: size + 16, height: size + 16 }}
      >
        {svgMarkup ? (
          <div
            className="h-full w-full [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-md bg-slate-100 text-[11px] text-slate-400 dark:bg-[#0f172a]">
            {loading ? "QR..." : "No QR"}
          </div>
        )}
      </div>
      {label ? (
        <div className={`text-center text-[11px] leading-snug text-slate-500 ${captionClassName}`.trim()}>
          {label}
        </div>
      ) : null}
    </div>
  );
}
