import Image from 'next/image'
import Link from 'next/link'
import { CheckIcon, SetaDireitaIcon } from '@/components/ModuleIcons'

// Seções da página inicial: para quem é (com as telas do sistema), planos e dúvidas frequentes

const AUDIENCES = [
  {
    shot: 'lite', alt: 'Tela do Anota Aí Leite com o leite do dia',
    eyebrow: 'Produtor', title: 'Só quer anotar o leite?',
    items: ['Um campo para o leite do dia', 'Funciona sem internet e por voz', 'Histórico e quanto vai receber'],
    cta: 'Começar grátis', href: '/lite/cadastro',
  },
  {
    shot: 'painel', alt: 'Painel da propriedade com tarefas do dia',
    eyebrow: 'Propriedade', title: 'Gestão completa da fazenda',
    items: ['Rebanho, crias, vacinas e reprodução', 'Leite, financeiro, estoque e relatórios', 'Equipe com acesso por perfil'],
    cta: 'Criar conta da propriedade', href: '/cadastro',
  },
  {
    shot: 'motorista', alt: 'Rota de hoje do motorista com as paradas',
    eyebrow: 'Motorista', title: 'A rota do dia no celular',
    items: ['Paradas na ordem, com acesso e telefone', 'Litros de cada sítio e tanque', 'Coleta não feita, com o motivo'],
    cta: 'Sou motorista', href: '/lite/cadastro?perfil=motorista',
  },
  {
    shot: 'laticinio', alt: 'Painel do laticínio com as paradas de hoje',
    eyebrow: 'Laticínio', title: 'Coleta organizada de ponta a ponta',
    items: ['Pontos de coleta, rotas e motoristas', 'Pendências do dia em tempo real', 'Recebido comparado com o coletado'],
    cta: 'Cadastrar laticínio', href: '/organizacao/cadastro?tipo=laticinio',
  },
  {
    shot: 'associacao', alt: 'Painel da associação com associados e serviços',
    eyebrow: 'Associação', title: 'Associados unidos e bem atendidos',
    items: ['Produção compartilhada e compras coletivas', 'Comunicados, visitas técnicas e mensalidades', 'Coleta compartilhada'],
    cta: 'Cadastrar associação', href: '/organizacao/cadastro?tipo=associacao',
  },
  {
    shot: 'fornecedor', alt: 'Painel do fornecedor com ofertas e pedidos',
    eyebrow: 'Fornecedor', title: 'Ofertas para quem precisa comprar',
    items: ['Ofertas para os produtores da região', 'Pedidos de orçamento e mensagens', 'Contato direto pelo WhatsApp'],
    cta: 'Sou fornecedor', href: '/fornecedor/cadastro',
  },
]

export function AudienceSection() {
  return (
    <section id="para-quem" className="landing-section landing-container">
      <div className="section-intro">
        <div>
          <p className="landing-eyebrow">Para quem é</p>
          <h2>Não é só um app da fazenda.<br /><em>Liga toda a cadeia do leite.</em></h2>
        </div>
        <p>Produtor, motorista, laticínio, associação e fornecedor usam o mesmo sistema, cada um com a sua tela. O leite anotado no sítio chega ao laticínio e à associação, e a oferta do fornecedor chega a quem está com o estoque baixo.</p>
      </div>
      <div className="audience-grid">
        {AUDIENCES.map((a) => (
          <article key={a.shot} className="audience-card">
            <div className="audience-shot">
              <Image src={`/landing/${a.shot}.webp`} alt={a.alt} width={780} height={1688} sizes="(max-width: 767px) 90vw, 360px" />
            </div>
            <div className="audience-body">
              <p className="landing-eyebrow">{a.eyebrow}</p>
              <h3>{a.title}</h3>
              <ul>
                {a.items.map((item) => <li key={item}><span aria-hidden="true"><CheckIcon className="w-3.5 h-3.5" /></span>{item}</li>)}
              </ul>
              <Link href={a.href} className="audience-link">{a.cta} <SetaDireitaIcon className="h-4 w-4" /></Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

const PLANS = [
  {
    name: 'Anota Aí Leite', price: 'Grátis', note: 'para sempre',
    text: 'Para o produtor que só quer anotar o leite e para o motorista da própria rota.',
    items: ['Leite do dia no celular', 'Funciona sem internet', 'Anotação por voz', 'Histórico e valor a receber', 'Participar de associações'],
    cta: 'Começar grátis', href: '/lite/cadastro', highlight: false,
  },
  {
    name: 'Completo', price: 'R$ 49', note: '/mês, a partir de',
    text: 'Gestão completa da propriedade, para toda a equipe.',
    tiers: [['Até 40 vacas', 'R$ 49/mês'], ['Até 100 vacas', 'R$ 99/mês'], ['Sem limite', 'R$ 199/mês']],
    items: ['Usuários sem limite', 'Rebanho, leite, saúde e reprodução', 'Financeiro, estoque e relatórios', 'Ofertas de fornecedores'],
    cta: 'Criar conta', href: '/cadastro', highlight: true,
  },
  {
    name: 'Laticínio e associação', price: 'Sob consulta', note: 'conforme o tamanho',
    text: 'Coleta, rotas e motoristas para o laticínio. Associados e serviços para a associação.',
    items: ['Motoristas sem custo extra', 'Pontos de coleta e rotas', 'Recebimento e pendências', 'Comunicados, visitas e mensalidades'],
    cta: 'Fale com a gente', href: '#contato', highlight: false,
  },
]

export function PlansSection() {
  return (
    <section id="planos" className="plans-section">
      <div className="landing-container">
        <div className="section-intro">
          <div>
            <p className="landing-eyebrow">Planos</p>
            <h2>Comece grátis.<br /><em>Cresça quando precisar.</em></h2>
          </div>
          <p>Sem taxa de implantação. O fornecedor divulga as ofertas sem custo durante o lançamento, e o motorista do laticínio ou da associação já vem incluído.</p>
        </div>
        <div className="plans-grid">
          {PLANS.map((p) => (
            <article key={p.name} className={`plan-card${p.highlight ? ' plan-highlight' : ''}`}>
              {p.highlight && <span className="plan-badge">Mais completo</span>}
              <h3>{p.name}</h3>
              <p className="plan-price"><strong>{p.price}</strong> <span>{p.note}</span></p>
              <p className="plan-text">{p.text}</p>
              {p.tiers && (
                <dl className="plan-tiers">
                  {p.tiers.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
                </dl>
              )}
              <ul>
                {p.items.map((item) => <li key={item}><span aria-hidden="true"><CheckIcon className="w-3.5 h-3.5" /></span>{item}</li>)}
              </ul>
              {p.href.startsWith('#')
                ? <a href={p.href} className={`landing-button ${p.highlight ? 'button-sage' : 'button-dark'}`}>{p.cta} <SetaDireitaIcon /></a>
                : <Link href={p.href} className={`landing-button ${p.highlight ? 'button-sage' : 'button-dark'}`}>{p.cta} <SetaDireitaIcon /></Link>}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

const FAQ = [
  ['Funciona sem internet?', 'Sim. As anotações do leite ficam guardadas no celular e são enviadas sozinhas quando a conexão volta. O motorista faz a rota inteira sem sinal.'],
  ['Preciso instalar alguma coisa?', 'Não. Abra o site no celular ou no computador e, se quiser, toque em "Instalar app" para ter o ícone na tela inicial, como um aplicativo.'],
  ['Dá para anotar falando?', 'Sim. Toque no microfone e fale a quantidade de litros. Funciona até sem internet.'],
  ['A associação ou o laticínio veem os meus dados?', 'Não. A associação só vê o total de leite se você autorizar, e você pode parar de mostrar quando quiser. Animais, financeiro e estoque continuam só seus.'],
  ['O motorista paga alguma coisa?', 'Não. O motorista cadastrado pelo laticínio ou pela associação já vem incluído, e quem anota a própria rota usa o Anota Aí Leite grátis.'],
  ['Quantas pessoas da fazenda podem usar?', 'Quantas precisar. Cada pessoa tem o seu acesso, e você escolhe o que cada uma pode ver ou editar.'],
  ['Sou fornecedor. Como apareço para os produtores?', 'Faça o cadastro da empresa. Depois da aprovação, suas ofertas aparecem para os produtores da região, e quem está com o produto acabando vê primeiro.'],
]

export function FaqSection() {
  return (
    <section id="duvidas" className="landing-section landing-container faq-grid">
      <div>
        <p className="landing-eyebrow">Dúvidas frequentes</p>
        <h2>Perguntas que<br /><em>sempre aparecem.</em></h2>
      </div>
      <div className="faq-list">
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
