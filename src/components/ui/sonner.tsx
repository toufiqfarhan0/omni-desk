"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4 text-emerald-600" />
        ),
        info: (
          <InfoIcon className="size-4 text-blue-600" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4 text-amber-600" />
        ),
        error: (
          <OctagonXIcon className="size-4 text-rose-600" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin text-zinc-600" />
        ),
      }}
      style={
        {
          "--normal-bg": "#ffffff",
          "--normal-text": "#09090b",
          "--normal-border": "#e4e4e7",
          "--success-bg": "#ffffff",
          "--success-text": "#09090b",
          "--success-border": "#86efac",
          "--error-bg": "#ffffff",
          "--error-text": "#09090b",
          "--error-border": "#fca5a5",
          "--warning-bg": "#ffffff",
          "--warning-text": "#09090b",
          "--warning-border": "#fde047",
          "--info-bg": "#ffffff",
          "--info-text": "#09090b",
          "--info-border": "#93c5fd",
          "--border-radius": "12px",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          background: "#ffffff",
          color: "#09090b",
          border: "1px solid #e4e4e7",
          boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04)",
          borderRadius: "12px",
          padding: "12px 16px",
          fontSize: "13px",
        },
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
