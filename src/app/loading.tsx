export default function RootLoading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        gap: "24px",
      }}
    >
      {/* Logo mark skeleton */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Brand wordmark shimmer */}
        <div
          className="skeleton-shimmer"
          style={{
            width: "120px",
            height: "20px",
            borderRadius: "6px",
          }}
        />
        <div
          className="skeleton-shimmer"
          style={{
            width: "72px",
            height: "12px",
            borderRadius: "4px",
          }}
        />
      </div>

      {/* Spinner ring */}
      <div className="omni-spinner" />

      {/* Progress bar */}
      <div
        style={{
          width: "180px",
          height: "2px",
          background: "#e4e4e7",
          borderRadius: "2px",
          overflow: "hidden",
        }}
      >
        <div className="omni-progress-bar" />
      </div>
    </div>
  );
}
