function PageHeader({ title, description, actions, className = "" }) {
  const classes = ["page-header", className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      <div>
        <h1 className="page-header__title">{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

export default PageHeader;
