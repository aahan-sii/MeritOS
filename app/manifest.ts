import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MeritOS Application Companion",
    short_name: "MeritOS",
    description: "Build a verified application profile, review opportunity matches, and manage prepared applications from any screen.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f4ef",
    theme_color: "#113c31",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/meritos-mark-v2.png",
        sizes: "672x672",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
