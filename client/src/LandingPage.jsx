function LandingPage({ onGetStarted }) {
  return (
    <div className="landing-shell">
      <header className="landing-header">
        <a className="landing-brand" href="/" aria-label="FairShare home">
          <span className="landing-brand__mark" aria-hidden="true">f</span>
          <span>FairShare</span>
        </a>
        <button className="landing-sign-in" type="button" onClick={onGetStarted}>
          Sign in
        </button>
      </header>

      <main className="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-copy">
            <p className="landing-eyebrow">A little more in sync</p>
            <h1 id="landing-title">
              Sharing a home,
              <span> made easier.</span>
            </h1>
            <p className="landing-description">
              Keep chores, shared expenses, and household conversations together
              in one calm place.
            </p>
            <button className="landing-cta" type="button" onClick={onGetStarted}>
              Get started
              <span aria-hidden="true">→</span>
            </button>
            <p className="landing-note">For roommates and households, big or small.</p>
          </div>

          <div className="landing-summary" aria-label="FairShare features">
            <div className="landing-summary__item">
              <span className="landing-summary__number">01</span>
              <div>
                <h2>Chores</h2>
                <p>Share the everyday tasks.</p>
              </div>
            </div>
            <div className="landing-summary__item">
              <span className="landing-summary__number">02</span>
              <div>
                <h2>Expenses</h2>
                <p>Keep shared costs clear.</p>
              </div>
            </div>
            <div className="landing-summary__item">
              <span className="landing-summary__number">03</span>
              <div>
                <h2>Household</h2>
                <p>Keep everyone in the loop.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>FairShare</span>
        <span>A simpler way to live together.</span>
      </footer>
    </div>
  );
}

export default LandingPage;
