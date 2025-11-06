export type StatusPedido =
  | 'NÃO INICIADO'
  | 'AGUARDANDO CORTE'
  | 'NA EXPEDIÇÃO'
  | 'FOI PARA EXPEDIÇÃO'

export interface Pedido {
  id?: string
  numero: string
  familia: 'TORRES' | 'PUXADORES'
  item: string
  qtd: number
  prazo: string
  acabamento: 'POLIDO' | 'ESCOVADO' | 'PINTURA'
  status: StatusPedido
  criadoEm: number
}
