import type { MetadataRoute } from "next";

// Name and look of the site when added to a phone's home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YASSNI.edge",
    short_name: "YASSNI.edge",
    description: "Personal trading desk: market regime, COT, journal and tools.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F1216",
    theme_color: "#0B0E12",
    lang: "en",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
