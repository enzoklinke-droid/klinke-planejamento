export const pad2 = (n: number) => String(n).padStart(2, '0')

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export const formatBR = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

export const isSameMonth = (iso: string, y: number, m: number) => {
  const d = new Date(iso)
  return d.getFullYear() === y && d.getMonth() + 1 === m
}

export const ymFromDate = (d: Date) => ({ y: d.getFullYear(), m: d.getMonth() + 1 })
