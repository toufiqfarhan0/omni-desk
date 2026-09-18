"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RealEstateDemoRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/demo/salon");
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#09090b", color: "#ffffff", fontFamily: "sans-serif" }}>
      <p>Redirecting to OmniDesk Hair Salon Demo...</p>
    </div>
  );
}
