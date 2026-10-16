export function calcularIdade(dataNascimento: string): { anos: number; meses: number; total: number } {
  const nascimento = new Date(dataNascimento);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nascimento.getFullYear();
  let meses = hoje.getMonth() - nascimento.getMonth();

  if (meses < 0) {
    anos--;
    meses += 12;
  }

  if (hoje.getDate() < nascimento.getDate()) {
    meses--;
    if (meses < 0) {
      anos--;
      meses += 12;
    }
  }

  return { anos, meses, total: anos * 12 + meses };
}

export function formatarIdade(dataNascimento: string): string {
  const { anos, meses } = calcularIdade(dataNascimento);
  return `${anos} Anos e ${meses} Meses`;
}

export function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/** Data de hoje no fuso local, no formato yyyy-mm-dd (para inputs type="date"). */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Primeiro e último dia do mês atual (aaaa-mm-dd, no horário do aparelho) */
/** Últimos `days` dias, contando hoje (ex.: 7 = de 6 dias atrás até hoje) */
export function lastDaysRange(days: number): { from: string; to: string } {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  return { from: iso(from), to: iso(to) };
}

export function currentMonthRange(): { from: string; to: string } {
  const d = new Date();
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/**
 * A data (gravada como meia-noite UTC) está entre `from` e `to`, inclusive? Compara só o dia (aaaa-mm-dd):
 * comparar com horário local trazia o dia seguinte junto no filtro.
 */
export function inDayRange(date: string | Date, from?: string, to?: string): boolean {
  const day = typeof date === 'string' ? date.slice(0, 10) : date.toISOString().slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

/** "Hoje" no horário de Brasília, como meia-noite UTC (formato em que as datas são gravadas). */
export function todayUTC(): Date {
  return new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()));
}

/** Link do WhatsApp com mensagem pronta. Aceita telefone com ou sem DDI. */
export function whatsappLink(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.length <= 11) digits = '55' + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
