import { useEffect, useMemo, useState } from 'react'
import type { Pedido, StatusPedido } from './types'
import { formatBR, isSameMonth, todayISO, ymFromDate } from './utils'

const STATUS: StatusPedido[] = [
  'NÃO INICIADO',
  'AGUARDANDO CORTE',
  'NA EXPEDIÇÃO',
  'FOI PARA EXPEDIÇÃO',
]

const FAMILIAS: Array<Pedido['familia']> = ['TORRES', 'PUXADORES']
const ACABAMENTOS: Array<Pedido['acabamento']> = ['POLIDO', 'ESCOVADO', 'PINTURA']
const STORAGE_KEY = 'klinke-planejamento:pedidos'

const ordenarPedidos = (lista: Pedido[]) =>
  [...lista].sort((a, b) => {
    const prazoDiff = a.prazo.localeCompare(b.prazo)
    if (prazoDiff !== 0) return prazoDiff
    return (a.numero ?? '').localeCompare(b.numero ?? '')
  })

const gerarId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type PedidoForm = Omit<Pedido, 'id'>

export default function App() {
  const hoje = new Date()
  const [viewYear, setViewYear] = useState(hoje.getFullYear())
  const [viewMonth, setViewMonth] = useState(hoje.getMonth() + 1)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [form, setForm] = useState<PedidoForm>({
    numero: '',
    familia: 'TORRES',
    item: '',
    qtd: 1,
    prazo: todayISO(),
    acabamento: 'POLIDO',
    status: 'NÃO INICIADO',
    criadoEm: Date.now(),
  })

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as Pedido[]
      const normalizados = parsed.map(p => ({
        ...p,
        id: p.id ?? gerarId(),
        criadoEm: p.criadoEm ?? Date.now(),
      }))
      setPedidos(ordenarPedidos(normalizados))
    } catch (error) {
      console.error('Não foi possível carregar pedidos salvos.', error)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pedidos))
  }, [pedidos])

  const pedidosMes = useMemo(
    () => pedidos.filter(p => isSameMonth(p.prazo, viewYear, viewMonth)),
    [pedidos, viewYear, viewMonth]
  )

  const totais = useMemo(() => {
    const porDia = new Map<string, number>()
    let totalMes = 0
    pedidosMes.forEach(p => {
      totalMes += p.qtd
      porDia.set(p.prazo, (porDia.get(p.prazo) ?? 0) + p.qtd)
    })
    return { totalMes, porDia }
  }, [pedidosMes])

  const mudarMes = (delta: number) => {
    let m = viewMonth + delta
    let y = viewYear
    if (m <= 0) {
      m = 12
      y -= 1
    }
    if (m >= 13) {
      m = 1
      y += 1
    }
    setViewMonth(m)
    setViewYear(y)
  }

  const onChange = (chave: keyof PedidoForm, valor: string | number) => {
    setForm(anterior => ({ ...anterior, [chave]: valor }))
  }

  const salvar = () => {
    if (!form.numero || !form.item || !form.qtd || !form.prazo) {
      alert('Preencha os campos obrigatórios.')
      return
    }

    const novo: Pedido = { ...form, id: gerarId(), criadoEm: Date.now() }
    setPedidos(prev => ordenarPedidos([...prev, novo]))
    setForm(prev => ({
      ...prev,
      numero: '',
      item: '',
      qtd: 1,
      status: 'NÃO INICIADO',
      criadoEm: Date.now(),
    }))
  }

  const atualizarStatus = (id: string, status: StatusPedido) => {
    setPedidos(prev =>
      prev.map(p => (p.id === id ? { ...p, status } : p))
    )
  }

  const remover = (id: string) => {
    if (!confirm('Remover este pedido?')) return
    setPedidos(prev => prev.filter(p => p.id !== id))
  }

  const { y, m } = ymFromDate(new Date(viewYear, viewMonth - 1, 1))
  const tituloMes = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  const ultimaAtualizacao = useMemo(
    () => new Date().toLocaleTimeString('pt-BR'),
    [pedidos]
  )

  return (
    <div className="wrapper">
      <div className="header">
        <h1>🦁 KLINKE – Planejamento</h1>
        <div className="month">
          <button className="btn btn-ghost" onClick={() => mudarMes(-1)}>◀</button>
          <b>{tituloMes}</b>
          <button className="btn btn-ghost" onClick={() => mudarMes(1)}>▶</button>
        </div>
      </div>

      <div className="kpi">
        <div className="box">
          <div className="title">Pedidos no mês</div>
          <div className="value">{pedidosMes.length}</div>
        </div>
        <div className="box">
          <div className="title">Peças no mês</div>
          <div className="value">{totais.totalMes}</div>
        </div>
        <div className="box">
          <div className="title">Hoje</div>
          <div className="value">{formatBR(todayISO())}</div>
        </div>
        <div className="box">
          <div className="title">Última atualização</div>
          <div className="value">{ultimaAtualizacao}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="row">
          <div style={{ gridColumn: 'span 2' }}>
            <label>Nº do Pedido</label>
            <input
              value={form.numero}
              onChange={event => onChange('numero', event.target.value)}
              placeholder="ex: 7397"
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label>Família</label>
            <select
              value={form.familia}
              onChange={event => onChange('familia', event.target.value)}
            >
              {FAMILIAS.map(familia => (
                <option key={familia} value={familia}>
                  {familia}
                </option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: 'span 4' }}>
            <label>Item / Produto</label>
            <input
              value={form.item}
              onChange={event => onChange('item', event.target.value)}
              placeholder="ex: Torre 300mm 1 furo"
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label>Quantidade</label>
            <input
              type="number"
              min={1}
              value={form.qtd}
              onChange={event => onChange('qtd', Number(event.target.value))}
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label>Prazo</label>
            <input
              type="date"
              value={form.prazo}
              onChange={event => onChange('prazo', event.target.value)}
            />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label>Acabamento</label>
            <select
              value={form.acabamento}
              onChange={event => onChange('acabamento', event.target.value)}
            >
              {ACABAMENTOS.map(acabamento => (
                <option key={acabamento} value={acabamento}>
                  {acabamento}
                </option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: 'span 3' }}>
            <label>Status</label>
            <select
              value={form.status}
              onChange={event => onChange('status', event.target.value)}
            >
              {STATUS.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'end' }}>
            <div className="btn-row">
              <button className="btn btn-main" onClick={salvar}>
                + Adicionar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <b>Totais por dia</b>
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Qtd</th>
            </tr>
          </thead>
          <tbody>
            {[...totais.porDia.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([dia, quantidade]) => (
                <tr key={dia}>
                  <td>{formatBR(dia)}</td>
                  <td>{quantidade}</td>
                </tr>
              ))}
            {totais.porDia.size === 0 && (
              <tr>
                <td colSpan={2}>
                  <small className="muted">Sem registros neste mês.</small>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="header">
          <b>Pedidos do mês</b>
          <small className="muted">
            {pedidosMes.length} pedidos • {totais.totalMes} peças
          </small>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Prazo</th>
              <th>Pedido</th>
              <th>Família</th>
              <th>Item</th>
              <th>Qtd</th>
              <th>Acab.</th>
              <th>Status</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {pedidosMes.map((pedido, index) => (
              <tr key={pedido.id ?? `${pedido.numero}-${pedido.prazo}-${index}`}>
                <td>
                  <span className="badge">{formatBR(pedido.prazo)}</span>
                </td>
                <td>{pedido.numero}</td>
                <td>{pedido.familia}</td>
                <td>{pedido.item}</td>
                <td>{pedido.qtd}</td>
                <td>{pedido.acabamento}</td>
                <td>
                  <select
                    value={pedido.status}
                    onChange={event =>
                      atualizarStatus(pedido.id!, event.target.value as StatusPedido)
                    }
                  >
                    {STATUS.map(status => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="btn-row">
                    <button className="btn btn-danger" onClick={() => remover(pedido.id!)}>
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {pedidosMes.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <small className="muted">Nenhum pedido para este mês.</small>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
