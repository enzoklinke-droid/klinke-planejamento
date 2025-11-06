import { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import jsPDF from 'jspdf'

const isBusinessDay = (d) => d.getDay() >= 1 && d.getDay() <= 5
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const fromISO = (s) => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d) }
const formatBR = (s) => { try { return fromISO(s).toLocaleDateString('pt-BR') } catch { return s } }

const linhaClass = (v) => (
  v === 'FOI PARA EXPEDIÇÃO' ? 'bg-green-200 text-green-800' :
  v === 'AGUARDANDO CORTE' ? 'bg-orange-200 text-orange-800' :
  'bg-blue-200 text-blue-800'
)

export default function App() {
  const [pedidos, setPedidos] = useState([])
  const [pedido, setPedido] = useState({ numero:'', familia:'TORRES', item:'', qtd:0, prazo:'', acabamento:'POLIDO', status:'NÃO INICIADO' })
  const [capacidade, setCapacidade] = useState({ TORRES:210, PUXADORES:55 })
  const [simulacao, setSimulacao] = useState({ TORRES:0, PUXADORES:0, resultado:'' })
  const hoje = new Date()
  const [viewYear, setViewYear] = useState(hoje.getFullYear())
  const [viewMonth, setViewMonth] = useState(hoje.getMonth())
  const [pdfModo, setPdfModo] = useState('mes')
  const [pdfDia, setPdfDia] = useState(toISO(new Date()))
  const toNumber = v => Math.max(0, Number(v)||0)

  const addPedido = () => {
    if(!pedido.numero||!pedido.item||pedido.qtd<=0||!pedido.prazo) return alert('Preencha nº, item, prazo e quantidade.')
    setPedidos(prev => [...prev, {...pedido, id:Date.now()+Math.random()}])
    setPedido({ numero:'', familia:'TORRES', item:'', qtd:0, prazo:'', acabamento:'POLIDO', status:'NÃO INICIADO' })
  }

  const atualizarStatus = (id, novoStatus) => {
    setPedidos(prev => prev.map(p => (p.id === id ? { ...p, status: novoStatus } : p)))
  }

  const atualizarLinhaProducao = (id, novaLinha) => {
    setPedidos(prev => prev.map(p => (p.id === id ? { ...p, linhaProducao: novaLinha } : p)))
  }

  const removerPedido = (id) => {
    setPedidos(prev => prev.filter(p => p.id !== id))
  }

  const pedidosOrdenados = useMemo(() => {
    return [...pedidos].sort((a, b) => new Date(a.prazo) - new Date(b.prazo))
  }, [pedidos])

  const agendaMapa = useMemo(()=>{
    const mapa = {}
    const ensure = (iso) => { if(!mapa[iso]) mapa[iso] = { TORRES:0, PUXADORES:0, tarefas:[] } }
    const ord = [...pedidosOrdenados]
    const nextBiz = (d) => { const n = new Date(d); do { n.setDate(n.getDate()+1) } while(!isBusinessDay(n)); return n }
    const limite = new Date(); limite.setFullYear(limite.getFullYear()+10)
    const start = new Date()

    for(const p of ord){
      let rest = toNumber(p.qtd)
      let cursor = new Date(start)
      while(rest>0 && cursor <= limite){
        if(!isBusinessDay(cursor)) { cursor = nextBiz(cursor); continue }
        const key = toISO(cursor)
        ensure(key)
        const fam = p.familia
        const usado = mapa[key][fam]
        const disp = Math.max(0, capacidade[fam] - usado)
        const aloc = Math.min(rest, disp)
        if(aloc>0){
          mapa[key][fam] += aloc
          mapa[key].tarefas.push({ ...p, qtd: aloc, linhaProducao: p.linhaProducao || 'AGUARDANDO CORTE' })
          rest -= aloc
        }
        if(rest>0) cursor = nextBiz(cursor)
      }
    }
    return mapa
  }, [pedidosOrdenados, capacidade])

  const diasMes = useMemo(()=>{
    const ref = new Date(viewYear, viewMonth, 1)
    const arr = []
    while(ref.getMonth() === viewMonth){
      if(isBusinessDay(ref)) arr.push(toISO(ref))
      ref.setDate(ref.getDate()+1)
    }
    return arr
  }, [viewYear, viewMonth])

  const ocupacaoDiaADia = useMemo(()=>{
    return diasMes.map(d => {
      const dia = agendaMapa[d] || { TORRES:0, PUXADORES:0, tarefas:[] }
      const pctT = capacidade.TORRES ? (dia.TORRES / capacidade.TORRES) * 100 : 0
      const pctP = capacidade.PUXADORES ? (dia.PUXADORES / capacidade.PUXADORES) * 100 : 0
      return { d, torres: dia.TORRES, pux: dia.PUXADORES, pctT, pctP, tarefas: dia.tarefas }
    })
  }, [diasMes, agendaMapa, capacidade])

  const gerarRelatorioPDF = () => {
    const pdf = new jsPDF()
    pdf.setFontSize(16)
    pdf.text('Plano Diário de Produção - KLINKE', 20, 20)
    let y = 34
    let diasParaImprimir = pdfModo === 'dia' ? [pdfDia] : ocupacaoDiaADia.map(d => d.d)
    const breakIfNeeded = (add = 8) => { if (y + add > 280) { pdf.addPage(); y = 20 } }

    diasParaImprimir.forEach((isoDia) => {
      const r = ocupacaoDiaADia.find(x => x.d === isoDia)
      if (!r || r.tarefas.length === 0) return
      const totAguard = r.tarefas.filter(t => (t.linhaProducao||'AGUARDANDO CORTE') === 'AGUARDANDO CORTE').length
      const totProd   = r.tarefas.filter(t => t.linhaProducao === 'ENTROU NA PRODUÇÃO').length
      const totExp    = r.tarefas.filter(t => t.linhaProducao === 'FOI PARA EXPEDIÇÃO').length
      pdf.setFontSize(13)
      breakIfNeeded(10)
      pdf.text(`${formatBR(r.d)}  |  Torres: ${r.torres}/${capacidade.TORRES}  |  Puxadores: ${r.pux}/${capacidade.PUXADORES}`, 20, y)
      y += 6
      pdf.setFontSize(10)
      pdf.text(`Totais do dia: Aguardando corte: ${totAguard}  |  Em produção: ${totProd}  |  Na expedição: ${totExp}` , 20, y)
      y += 6
      r.tarefas.forEach(t => {
        breakIfNeeded(6)
        const estado = t.linhaProducao || 'AGUARDANDO CORTE'
        pdf.text(`• Pedido ${t.numero} | ${t.item} | ${t.qtd} un. | ${t.familia} | ${t.acabamento} | ${estado}` , 25, y)
        y += 5
      })
      y += 3
    })
    const nome = pdfModo === 'dia' ? `Plano_Diario_KLINKE_${pdfDia}.pdf` : `Plano_Diario_KLINKE_${toISO(new Date())}.pdf`
    pdf.save(nome)
  }

  const prevM = ()=>{ let y=viewYear, m=viewMonth-1; if(m<0){ m=11; y-- } setViewYear(y); setViewMonth(m) }
  const nextM = ()=>{ let y=viewYear, m=viewMonth+1; if(m>11){ m=0; y++ } setViewYear(y); setViewMonth(m) }

  return (
  <div className="p-6 space-y-8 bg-gray-50 min-h-screen">
    <h1 className="text-3xl font-extrabold text-center text-orange-600">Planejador de Produção - KLINKE</h1>

    <div className="max-w-6xl mx-auto flex flex-wrap gap-3 items-center justify-between">
      <div className="flex gap-2 items-center">
        <Button onClick={prevM}>Anterior</Button>
        <input type="month" value={`${viewYear}-${String(viewMonth+1).padStart(2,'0')}`} onChange={(e)=>{ const [y,m]=e.target.value.split('-').map(Number); if(!isNaN(y)&&!isNaN(m)){ setViewYear(y); setViewMonth(m-1) } }} className="border p-2 rounded"/>
        <Button onClick={()=>{ const d=new Date(); setViewYear(d.getFullYear()); setViewMonth(d.getMonth())}}>Hoje</Button>
        <Button onClick={nextM}>Próximo</Button>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-sm">Relatório:</label>
        <select value={pdfModo} onChange={e=>setPdfModo(e.target.value)} className="border p-2 rounded">
          <option value="mes">Mês em exibição</option>
          <option value="dia">Apenas o dia</option>
        </select>
        {pdfModo==='dia' && (
          <input type="date" value={pdfDia} onChange={e=>setPdfDia(e.target.value)} className="border p-2 rounded" />
        )}
        <Button onClick={gerarRelatorioPDF} className="bg-red-600 hover:bg-red-700">Gerar Relatório PDF</Button>
      </div>
    </div>

    <Card className="max-w-6xl mx-auto bg-white p-6">
      <CardContent>
        <h3 className="text-xl font-bold text-orange-600 mb-4 text-center">Adicionar Pedido</h3>
        <div className="flex flex-wrap gap-3 justify-center mb-6">
          <input placeholder="Nº Pedido" value={pedido.numero} onChange={e=>setPedido({...pedido,numero:e.target.value})} className="border p-2 rounded w-28 text-center"/>
          <select value={pedido.familia} onChange={e=>setPedido({...pedido,familia:e.target.value})} className="border p-2 rounded w-32 text-center">
            <option>TORRES</option>
            <option>PUXADORES</option>
          </select>
          <input placeholder="Item" value={pedido.item} onChange={e=>setPedido({...pedido,item:e.target.value})} className="border p-2 rounded w-40 text-center"/>
          <input type="number" placeholder="Qtd" value={pedido.qtd} onChange={e=>setPedido({...pedido,qtd:e.target.value})} className="border p-2 rounded w-20 text-center"/>
          <input type="date" value={pedido.prazo} onChange={e=>setPedido({...pedido,prazo:e.target.value})} className="border p-2 rounded w-40 text-center"/>
          <select value={pedido.acabamento} onChange={e=>setPedido({...pedido,acabamento:e.target.value})} className="border p-2 rounded w-36 text-center">
            <option>POLIDO</option>
            <option>ESCOVADO</option>
            <option>PINTURA</option>
            <option>SEM ACABAMENTO</option>
          </select>
          <Button onClick={addPedido} className="bg-green-600 hover:bg-green-700">Adicionar</Button>
        </div>
      </CardContent>
    </Card>

    <Card className="max-w-6xl mx-auto bg-white">
      <CardContent>
        <h3 className="text-xl font-bold text-orange-600 text-center">Lista de Pedidos</h3>
        <table className="w-full text-sm border mt-2 text-center border-collapse">
          <thead className="bg-orange-100 border-b">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">Pedido</th>
              <th className="p-2">Família</th>
              <th className="p-2">Item</th>
              <th className="p-2">Qtd</th>
              <th className="p-2">Prazo</th>
              <th className="p-2">Acab.</th>
              <th className="p-2">Status</th>
              <th className="p-2">Remover</th>
            </tr>
          </thead>
          <tbody>
            {pedidosOrdenados.map((p,i)=>(
              <tr key={p.id} className="border-t hover:bg-orange-50">
                <td className="p-2">{i+1}</td>
                <td className="p-2">{p.numero}</td>
                <td className="p-2">{p.familia}</td>
                <td className="p-2">{p.item}</td>
                <td className="p-2">{p.qtd}</td>
                <td className="p-2">{p.prazo && formatBR(p.prazo)}</td>
                <td className="p-2">{p.acabamento}</td>
                <td className="p-2">
                  <select value={p.status} onChange={(e)=>atualizarStatus(p.id, e.target.value)} className="border p-1 rounded">
                    <option>NÃO INICIADO</option>
                    <option>AGUARDANDO CORTE</option>
                    <option>CORTADO</option>
                    <option>NA EXPEDIÇÃO</option>
                  </select>
                </td>
                <td className="p-2">
                  <Button title="Remover pedido" onClick={()=>removerPedido(p.id)} className="bg-red-500 hover:bg-red-600 px-2 py-1">X</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>

    <div className="max-w-6xl mx-auto flex justify-between items-center">
      <Button onClick={prevM}>Anterior</Button>
      <h2 className="text-xl font-bold">{new Date(viewYear,viewMonth,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2>
      <Button onClick={nextM}>Próximo</Button>
    </div>
  </div>
  )
}
