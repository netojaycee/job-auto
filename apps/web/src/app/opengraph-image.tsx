import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #1e1b4b 0%, #3730d8 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "rgba(255,255,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
              <path
                d="M10 20.5L15 13.5L19 18L22 11.5"
                stroke="white"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M22 11.5H17.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 11.5V16" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="10" cy="20.5" r="1.7" fill="white" />
            </svg>
          </div>
          <span style={{ fontSize: 32, fontWeight: 700 }}>job-auto</span>
        </div>
        <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1, maxWidth: 900 }}>
          Job search on autopilot
        </div>
        <div style={{ fontSize: 26, marginTop: 24, opacity: 0.85, maxWidth: 800 }}>
          Build your profile once. We find matching roles daily and tailor every application.
        </div>
      </div>
    ),
    { ...size },
  );
}
