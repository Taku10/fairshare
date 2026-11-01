function Button({
  variant = "primary",
  className = "",
  loading = false,
  loadingLabel = "Loading",
  disabled,
  children,
  type = "button",
  ...props
}) {
  const classes = ["btn", `btn-${variant}`, className].filter(Boolean).join(" ");

  return (
    <button
      {...props}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && (
        <>
          <span className="button-spinner" aria-hidden="true" />
          <span className="visually-hidden">{loadingLabel}</span>
        </>
      )}
      {children}
    </button>
  );
}

export default Button;
