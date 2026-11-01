function EmptyState({ title, description, action, className = "" }) {
  const classes = ["empty-state", className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      <h2 className="empty-state__title">{title}</h2>
      {description && <p className="empty-state-text">{description}</p>}
      {action}
    </div>
  );
}

export default EmptyState;
