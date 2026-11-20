// Nom du site : « YASSNI » en gras, « .edge » dans la couleur d'accent.
export const SITE_NAME = "YASSNI.edge";

export default function BrandName() {
  return (
    <div className="brand-name" aria-label={SITE_NAME}>
      <span style={{ fontWeight: 700, letterSpacing: "0.02em" }}>YASSNI</span>
      <span style={{ color: "var(--accent)", fontWeight: 500 }}>.edge</span>
    </div>
  );
}
