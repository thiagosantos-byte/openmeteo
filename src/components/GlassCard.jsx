export default function GlassCard({ title, eyebrow, icon: Icon, children, className = '', action }) {
  return (
    <section className={`glass-card ${className}`}>
      <div className="glass-card__heading">
        <div className="glass-card__label">
          {Icon && <Icon size={14} strokeWidth={1.8} />}
          <span>{eyebrow || title}</span>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
