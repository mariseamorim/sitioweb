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
