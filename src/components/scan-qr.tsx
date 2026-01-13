"use client";

import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import { useEffect, useMemo, useRef, useState } from "react";

type Parsed = {
  kioskId: string;
  nonce: string;
  exp?: number; // epoch ms
  raw: string;
};

function parseKioskQr(text: string): Parsed | null {
  // Supports URL format:
  // https://.../employee/scan?k=...&n=...&e=...
  // Also supports JSON format as fallback:
  // {"kioskId":"...","nonce":"...","exp":123}

  try {
    if (text.startsWith("http")) {
      const url = new URL(text);
      const kioskId = url.searchParams.get("k") ?? "";
      const nonce = url.searchParams.get("n") ?? "";
      const e = url.searchParams.get("e");
      const exp = e ? Number(e) : undefined;

      if (!kioskId || !nonce) return null;
      return { kioskId, nonce, exp, raw: text };
    }

    const obj = JSON.parse(text);
    const kioskId = obj.kioskId ?? obj.k ?? "";
    const nonce = obj.nonce ?? obj.n ?? "";
    const exp = typeof obj.exp === "number" ? obj.exp : undefined;

    if (!kioskId || !nonce) return null;
    return { kioskId, nonce, exp, raw: text };
  } catch {
    return null;
  }
}

export default function ScanQrNow() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reader = useMemo(() => new BrowserMultiFormatReader(), []);

  const [status, setStatus] = useState<"SCANNING" | "SCANNED" | "ERROR">(
    "SCANNING"
  );
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [isExpired, setIsExpired] = useState<boolean | null>(null);

  useEffect(() => {
    if (status !== "SCANNING") return;

    let stopped = false;
    let controls: IScannerControls | null = null;

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;

        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const deviceId = devices[0]?.deviceId; // you can pick rear cam later

        controls = await reader.decodeFromVideoDevice(
          deviceId,
          video,
          (result, _error, scannerControls) => {
            if (!result || stopped) return;

            const text = result.getText();
            const data = parseKioskQr(text);

            if (!data) {
              setError("Invalid QR format. Please scan the kiosk QR.");
              setStatus("ERROR");
              stopped = true;
              scannerControls.stop();
              return;
            }

            const expired = data.exp ? Date.now() > data.exp : false;
            alert(
              `SCANNED ✅\nKiosk: ${data.kioskId}\nNonce: ${data.nonce}\nExp: ${
                data.exp ?? "none"
              }`
            );

            setParsed(data);
            setIsExpired(expired);
            setStatus("SCANNED");

            alert(
              `SCANNED ✅\nKiosk: ${data.kioskId}\nNonce: ${data.nonce}\nExp: ${
                data.exp ?? "none"
              }`
            );
            // stop camera after successful scan
            stopped = true;
            scannerControls.stop();
          }
        );
        if (stopped && controls) {
          controls.stop();
        }
      } catch (e: any) {
        setError(e?.message ?? "Camera error. Please allow camera permission.");
        setStatus("ERROR");
        controls?.stop();
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [reader, status]);

  const scanAgain = () => {
    setParsed(null);
    setIsExpired(null);
    setError("");
    setStatus("SCANNING");
  };

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <h2>Employee Scan</h2>

      {status === "SCANNING" && (
        <>
          <p>Point your camera at the kiosk QR code.</p>
          <video
            ref={videoRef}
            style={{ width: "100%", borderRadius: 12, background: "#000" }}
          />
          <p style={{ fontSize: 12, opacity: 0.75 }}>
            If the camera doesn’t open, check browser permissions and use HTTPS
            in production.
          </p>
        </>
      )}

      {status === "SCANNED" && parsed && (
        <>
          <p>
            Scan result:{" "}
            <b style={{ color: isExpired ? "crimson" : "green" }}>
              {isExpired ? "EXPIRED" : "VALID"}
            </b>
          </p>

          <div
            style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}
          >
            <div>
              <b>Kiosk ID:</b> {parsed.kioskId}
            </div>
            <div>
              <b>Nonce:</b> {parsed.nonce}
            </div>
            <div>
              <b>Expiry (ms):</b> {parsed.exp ?? "Not provided"}
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                wordBreak: "break-all",
                opacity: 0.8,
              }}
            >
              <b>Raw:</b> {parsed.raw}
            </div>
          </div>

          <button onClick={scanAgain} style={{ marginTop: 12 }}>
            Scan again
          </button>
        </>
      )}

      {status === "ERROR" && (
        <>
          <p style={{ color: "crimson" }}>{error}</p>
          <button onClick={scanAgain}>Try again</button>
        </>
      )}
    </div>
  );
}
