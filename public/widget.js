(function () {
  const currentScript =
    document.currentScript ||
    document.querySelector("script[data-business-id]");
  const businessId =
    currentScript?.getAttribute("data-business-id") || "biz_demo_dental";
  const theme = currentScript?.getAttribute("data-theme") || "dark";
  const accent = currentScript?.getAttribute("data-accent") || "slate";
  const position =
    currentScript?.getAttribute("data-position") || "bottom-right";
  const label =
    currentScript?.getAttribute("data-label") || "Talk to Receptionist";

  const origin = new URL(currentScript?.src || window.location.href).origin;

  const container = document.createElement("div");
  container.id = "omnidesk-voice-widget-root";
  container.style.position = "fixed";
  container.style.zIndex = "999999";
  if (position === "bottom-left") {
    container.style.left = "24px";
    container.style.bottom = "24px";
  } else {
    container.style.right = "24px";
    container.style.bottom = "24px";
  }

  const btn = document.createElement("button");
  btn.innerText = label;
  btn.style.cssText =
    "background: #171717; color: #ededed; border: 1px solid #333; padding: 10px 18px; border-radius: 9999px; font-family: sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 10px 25px rgba(0,0,0,0.3); display: flex; items-center; gap: 8px;";

  btn.onclick = function () {
    window.open(`${origin}/demo?businessId=${businessId}`, "_blank", "width=480,height=720");
  };

  container.appendChild(btn);
  document.body.appendChild(container);
})();
