import type { Metadata } from 'next'
import Image from 'next/image'
import { MilkDemo } from '@/components/MilkDemo'
import Link from 'next/link'
import { AnimalIcon, LeiteIcon, TratamentoIcon, FinanceiroIcon, EstoqueIcon, PainelIcon, SincronizarIcon, CheckIcon, SetaDireitaIcon } from '@/components/ModuleIcons'
import { LandingHeader } from '@/components/LandingHeader'
import { ContactForm } from '@/components/ContactForm'
import { AudienceSection, FaqSection, PlansSection } from './sections'
import './landing.css'

export const metadata: Metadata = { title: 'Anota Aí Leite — Anote o leite e confira os litros', description: 'Anote o leite do dia, acompanhe o histórico e confira a folha do motorista. Grátis, com anotações sem internet. Experimente sem cadastro.' }
const features = [
  { Icon: AnimalIcon, title: 'Rebanho organizado', text: 'Cada animal identificado, com foto, informações e registros em um só lugar.' },
  { Icon: LeiteIcon, title: 'Produção de leite', text: 'Lançamentos individuais ou em lote e acompanhamento por período.' },
  { Icon: TratamentoIcon, title: 'Saúde em dia', text: 'Tratamentos, vacinas, medicamentos e agenda de cuidados.' },
  { Icon: FinanceiroIcon, title: 'Financeiro claro', text: 'Receitas, despesas e saldo para decidir com mais segurança.' },
  { Icon: EstoqueIcon, title: 'Estoque sob controle', text: 'Saiba o que entrou, saiu e o que precisa ser reposto.' },
  { Icon: PainelIcon, title: 'Painel completo', text: 'Os indicadores mais importantes da propriedade em uma visão.' },
]
export default function LandingPage() {
  return <main className="rural-landing" id="inicio">
    <a className="landing-skip" href="#experimentar">Pular para o conteúdo</a>
    <LandingHeader />
    <section className="landing-hero"><div className="landing-container hero-content">
      <p className="landing-eyebrow">Anota Aí Leite · Grátis para sempre</p>
      <h1>Anote o leite do dia.<br /><em>Confira os litros</em><br />com o motorista.</h1>
      <p className="hero-description">Guarde suas anotações no celular, acompanhe o total e confira a folha do motorista. As anotações funcionam mesmo sem internet.</p>
      <div className="landing-actions"><a className="landing-button button-sage" href="#experimentar">Experimentar sem cadastro <SetaDireitaIcon /></a><Link className="landing-button button-outline" href="/lite/cadastro">Começar grátis <SetaDireitaIcon /></Link></div><p className="mt-4 text-sm text-green-100">Sem cartão. Sem precisar cadastrar o rebanho.</p>
    </div><div className="hero-caption landing-container">Do leite anotado ao total que você tem para conferir.</div></section>
    <MilkDemo />
    <section id="recursos" className="landing-section landing-container">
      <div className="section-intro"><div><p className="landing-eyebrow">Também precisa de gestão completa?</p><h2>Cuide também<br /><em>da sua propriedade.</em></h2></div><p>Do primeiro cadastro ao fechamento do mês, o Anota Aí Agro transforma a rotina da fazenda em informações simples para você acompanhar o que realmente importa.</p></div>
      <div className="feature-grid">{features.map(({ Icon, title, text }) => <article key={title} className="feature-card"><span className="feature-icon" aria-hidden="true"><Icon className="w-6 h-6" /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>
    <AudienceSection />
    <section id="ofertas" className="offers-section"><div className="landing-container offers-grid">
      <div><p className="landing-eyebrow">Ofertas de fornecedores</p><h2>Encontre os insumos que sua propriedade precisa.</h2><p className="section-description">Veja ofertas de ração, sal mineral e outros insumos de fornecedores aprovados da sua região. Quando um produto do estoque está acabando, as ofertas dele aparecem primeiro, e o contato é direto pelo WhatsApp.</p><a className="landing-button button-dark" href="#fornecedores">Sou fornecedor <SetaDireitaIcon /></a></div>
      <div className="offer-shot"><Image src="/landing/ofertas.webp" alt="Tela de ofertas de fornecedores no celular do produtor" width={780} height={1688} sizes="(max-width: 767px) 80vw, 340px" /></div>
    </div><div id="fornecedores" className="landing-container supplier-note"><h3>Você vende ração, sal mineral ou outros insumos?</h3><p>Divulgue suas ofertas para os produtores da região, convide seus clientes e acompanhe quem chamou no WhatsApp. O cadastro da empresa passa por aprovação.</p><p><Link href="/criar-conta" className="font-semibold underline">Criar conta de fornecedor</Link></p></div></section>
    <section id="como-funciona" className="landing-section landing-container routine-grid">
      <div className="offline-card"><span className="offline-mark" aria-hidden="true"><SincronizarIcon className="w-12 h-12" /></span><h2>A rotina não para quando a internet cai. Seu sistema também não.</h2><p>Nos módulos com suporte offline, novos registros ficam salvos no aparelho e são enviados quando a conexão volta.</p><span className="offline-label">Salve offline e sincronize depois</span></div>
      <div className="routine-copy"><p className="landing-eyebrow">Feito para a vida real</p><h2>Menos papelada.<br /><em>Mais tempo para o que importa.</em></h2><p className="section-description">Uma ferramenta simples para toda a equipe usar, no computador ou no celular. Tenha os dados da propriedade à mão e acompanhe o que está acontecendo de verdade.</p><ul>{[['Reprodução', 'Coberturas, previsões e partos acompanhados de perto.'], ['Vacinação', 'Agende aplicações e registre os cuidados com cada animal.'], ['Fazendas e usuários', 'Acesso por perfil e módulo para cada pessoa da equipe.']].map(([title, text]) => <li key={title}><span aria-hidden="true"><CheckIcon className="w-4 h-4" /></span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ul></div>
    </section>
    <PlansSection />
    <FaqSection />
    <section id="contato" className="landing-section landing-container contact-grid" aria-labelledby="contact-title">
      <div><p className="landing-eyebrow">Fale conosco</p><h2 id="contact-title">Conheça o Anota Aí Agro na prática.</h2><p className="contact-description">Quer tirar uma dúvida ou entender como o sistema pode ajudar na sua propriedade? Fale com a gente ou solicite uma demonstração. Combinamos por e-mail o melhor dia e horário para você.</p></div>
      <ContactForm />
    </section>
    <section id="comecar" className="landing-cta"><div className="landing-container"><div><p className="landing-eyebrow">Pronto para simplificar?</p><h2>Comece anotando o leite de hoje.</h2></div><Link href="/lite/cadastro" className="landing-button button-dark">Começar grátis <SetaDireitaIcon /></Link></div></section>
    <footer className="landing-footer landing-container"><a href="#inicio" className="landing-brand"><Image src="/anota-ai-agro-logo.png" width={1632} height={473} alt="Anota Aí Agro" className="landing-brand-logo" /></a><p>Gestão rural simples, de verdade.</p><div><Link href="/login">Entrar no sistema</Link><Link href="/ajuda">Ajuda e suporte</Link><a href="#contato">Fale conosco</a><a href="mailto:anotaaiagro@gmail.com">anotaaiagro@gmail.com</a><span>© {new Date().getFullYear()} Anota Aí Agro</span></div></footer>
  </main>
}
