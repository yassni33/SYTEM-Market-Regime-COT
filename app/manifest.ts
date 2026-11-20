import type { MetadataRoute } from "next";

// Nom et apparence du site quand il est ajouté à l'écran d'accueil du téléphone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YASSNI.edge",
    short_name: "YASSNI.edge",
    description: "Espace de trading personnel : régime de marché, COT, journal et outils.",
    start_url: "/",
    display: "standalone",
    background_color: "#F3F5F7",
    theme_color: "#F3F5F7",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
