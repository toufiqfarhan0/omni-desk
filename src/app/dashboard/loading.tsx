export default function DashboardLoading() {
  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        background: "#fafafa",
      }}
    >
      {/* Sidebar skeleton */}
      <div
        style={{
          width: "270px",
          minHeight: "100vh",
          background: "#ffffff",
          borderRight: "1px solid #e4e4e7",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "4px 0 12px" }}>
          <div className="skeleton-shimmer" style={{ width: "28px", height: "28px", borderRadius: "7px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <div className="skeleton-shimmer" style={{ width: "80px", height: "13px", borderRadius: "4px" }} />
            <div className="skeleton-shimmer" style={{ width: "52px", height: "10px", borderRadius: "3px" }} />
          </div>
        </div>

        {/* Business selector */}
        <div>
          <div className="skeleton-shimmer" style={{ width: "90px", height: "9px", borderRadius: "3px", marginBottom: "8px" }} />
          <div className="skeleton-shimmer" style={{ width: "100%", height: "36px", borderRadius: "8px" }} />
        </div>

        {/* Nav items */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div className="skeleton-shimmer" style={{ width: "70px", height: "9px", borderRadius: "3px", marginBottom: "6px" }} />
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="skeleton-shimmer"
              style={{ width: "100%", height: "38px", borderRadius: "8px" }}
            />
          ))}
        </div>

        {/* Quick access */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
          <div className="skeleton-shimmer" style={{ width: "80px", height: "9px", borderRadius: "3px", marginBottom: "6px" }} />
          {[1, 2].map((i) => (
            <div
              key={i}
              className="skeleton-shimmer"
              style={{ width: "100%", height: "32px", borderRadius: "8px" }}
            />
          ))}
        </div>

        {/* Bottom user info */}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "10px", paddingTop: "16px", borderTop: "1px solid #e4e4e7" }}>
          <div className="skeleton-shimmer" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton-shimmer" style={{ width: "80px", height: "11px", borderRadius: "3px", marginBottom: "5px" }} />
            <div className="skeleton-shimmer" style={{ width: "120px", height: "10px", borderRadius: "3px" }} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <div
          style={{
            height: "64px",
            background: "#ffffff",
            borderBottom: "1px solid #e4e4e7",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="skeleton-shimmer" style={{ width: "70px", height: "12px", borderRadius: "4px" }} />
            <div style={{ color: "#a1a1aa", fontSize: "12px" }}>/</div>
            <div className="skeleton-shimmer" style={{ width: "100px", height: "12px", borderRadius: "4px" }} />
          </div>
          <div className="skeleton-shimmer" style={{ width: "140px", height: "28px", borderRadius: "99px" }} />
        </div>

        {/* Workspace skeleton */}
        <div style={{ padding: "28px", flex: 1 }}>
          {/* Two-column layout */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px", maxWidth: "1260px", margin: "0 auto" }}>
            {/* Left card */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e4e4e7",
                borderRadius: "12px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {/* Card header */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div className="skeleton-shimmer" style={{ width: "180px", height: "16px", borderRadius: "5px" }} />
                <div className="skeleton-shimmer" style={{ width: "280px", height: "12px", borderRadius: "4px" }} />
              </div>

              {/* Form rows */}
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div className="skeleton-shimmer" style={{ width: "90px", height: "11px", borderRadius: "3px" }} />
                  <div className="skeleton-shimmer" style={{ width: "100%", height: "40px", borderRadius: "8px" }} />
                </div>
              ))}

              {/* Two-col row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                {[1, 2].map((i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div className="skeleton-shimmer" style={{ width: "70px", height: "11px", borderRadius: "3px" }} />
                    <div className="skeleton-shimmer" style={{ width: "100%", height: "40px", borderRadius: "8px" }} />
                  </div>
                ))}
              </div>

              {/* Textarea */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div className="skeleton-shimmer" style={{ width: "130px", height: "11px", borderRadius: "3px" }} />
                <div className="skeleton-shimmer" style={{ width: "100%", height: "100px", borderRadius: "8px" }} />
              </div>

              {/* Button row */}
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <div className="skeleton-shimmer" style={{ width: "100px", height: "36px", borderRadius: "8px" }} />
                <div className="skeleton-shimmer" style={{ width: "120px", height: "36px", borderRadius: "8px" }} />
              </div>
            </div>

            {/* Right panel card */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e4e4e7",
                borderRadius: "12px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {/* Agent header */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="skeleton-shimmer" style={{ width: "42px", height: "42px", borderRadius: "50%" }} />
                <div>
                  <div className="skeleton-shimmer" style={{ width: "110px", height: "14px", borderRadius: "4px", marginBottom: "6px" }} />
                  <div className="skeleton-shimmer" style={{ width: "80px", height: "22px", borderRadius: "6px" }} />
                </div>
              </div>

              {/* Preview section */}
              <div style={{ borderTop: "1px solid #e4e4e7", paddingTop: "14px" }}>
                <div className="skeleton-shimmer" style={{ width: "120px", height: "10px", borderRadius: "3px", marginBottom: "8px" }} />
                <div className="skeleton-shimmer" style={{ width: "100%", height: "56px", borderRadius: "8px" }} />
              </div>

              {/* Agent ID row */}
              <div>
                <div className="skeleton-shimmer" style={{ width: "100px", height: "10px", borderRadius: "3px", marginBottom: "8px" }} />
                <div className="skeleton-shimmer" style={{ width: "100%", height: "36px", borderRadius: "8px" }} />
              </div>

              {/* Tools pills */}
              <div>
                <div className="skeleton-shimmer" style={{ width: "130px", height: "10px", borderRadius: "3px", marginBottom: "10px" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="skeleton-shimmer" style={{ height: "28px", borderRadius: "6px" }} />
                  ))}
                </div>
              </div>

              {/* Services */}
              <div style={{ borderTop: "1px solid #e4e4e7", paddingTop: "14px" }}>
                <div className="skeleton-shimmer" style={{ width: "110px", height: "10px", borderRadius: "3px", marginBottom: "10px" }} />
                {[1, 2].map((i) => (
                  <div key={i} className="skeleton-shimmer" style={{ width: "100%", height: "60px", borderRadius: "8px", marginBottom: "8px" }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
