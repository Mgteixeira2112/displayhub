import { FormEvent, useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type Props = { companyId: string; role: string }
type TemplateType = 'fullscreen_video' | 'promo_image' | 'menu' | 'price_table' | 'split_screen' | 'notice_board'
type Template = { id: string; name: string; template_type: TemplateType; is_active: boolean }

export const templateLabels: Record<TemplateType, string> = {
  fullscreen_video: 'Vídeo em tela cheia',
  promo_image: 'Imagem promocional',
  menu: 'Cardápio',
  price_table: 'Tabela de preços',
  split_screen: 'Tela dividida',
  notice_board: 'Mural de avisos',
}

export default function TemplateManager({ companyId, role }: Props) {
  const canManage = role === 'admin' || role === 'manager'
  const [templates, setTemplates] = useState<Template[]>([])
  const [name, setName] = useState('')
  const [templateType, setTemplateType] = useState<TemplateType>('promo_image')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const loadTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from('display_templates')
      .select('id,name,template_type,is_active')
      .order('created_at')
    if (error) throw error
    setTemplates((data || []) as Template[])
  }, [])

  useEffect(() => {
    void loadTemplates().catch(() => setMessage('Não foi possível carregar os templates.'))
  }, [loadTemplates])

  async function createTemplate(event: FormEvent) {
    event.preventDefault()
    if (!canManage) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.from('display_templates').insert({
      company_id: companyId,
      name: name.trim(),
      template_type: templateType,
    })
    if (error) setMessage(error.message)
    else {
      setName('')
      await loadTemplates()
    }
    setBusy(false)
  }

  async function removeTemplate(id: string) {
    if (!canManage) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.from('display_templates').delete().eq('id', id)
    if (error) setMessage(error.message)
    else await loadTemplates()
    setBusy(false)
  }

  return (
    <section className="workspace-section template-workspace">
      <div className="section-heading">
        <div><p className="eyebrow">Fase 6</p><h2>Templates</h2></div>
        <button className="secondary-button compact" type="button" onClick={() => void loadTemplates()} disabled={busy}>Atualizar</button>
      </div>
      <p className="empty-state">Modelos fechados de apresentação. O player público usará estes templates na Fase 7.</p>
      {message && <p className="form-message">{message}</p>}

      {canManage && (
        <form className="content-form template-form" onSubmit={createTemplate}>
          <h3>Novo template</h3>
          <label>Nome<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Promoção principal" /></label>
          <label>Modelo<select value={templateType} onChange={(e) => setTemplateType(e.target.value as TemplateType)}>
            {Object.entries(templateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <button className="primary-button" disabled={busy}>Criar template</button>
        </form>
      )}

      <div className="template-grid">
        {templates.length === 0 && <p className="empty-state">Nenhum template criado.</p>}
        {templates.map((template) => (
          <article className="template-card" key={template.id}>
            <span>{templateLabels[template.template_type]}</span>
            <strong>{template.name}</strong>
            <small>{template.is_active ? 'Ativo' : 'Inativo'}</small>
            {canManage && <button className="danger-button" type="button" onClick={() => void removeTemplate(template.id)} disabled={busy}>Excluir template</button>}
          </article>
        ))}
      </div>
    </section>
  )
}
