function App() {
  return (
    <main className="app-shell">
      <section className="hero-card" aria-labelledby="displayhub-title">
        <div className="brand-mark" aria-hidden="true">DH</div>
        <p className="eyebrow">Fundação técnica ativa</p>
        <h1 id="displayhub-title">DisplayHub</h1>
        <p className="lead">
          Plataforma independente para criação e gerenciamento de displays comerciais acessados por links.
        </p>
        <div className="status-grid" aria-label="Status da fundação">
          <article>
            <span>Aplicação</span>
            <strong>React + TypeScript</strong>
          </article>
          <article>
            <span>Dados</span>
            <strong>Supabase</strong>
          </article>
          <article>
            <span>Fase atual</span>
            <strong>Fase 0</strong>
          </article>
        </div>
        <p className="footnote">Nenhuma funcionalidade de negócio foi habilitada nesta etapa.</p>
      </section>
    </main>
  )
}

export default App
