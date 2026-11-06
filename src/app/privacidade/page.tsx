import type { Metadata } from 'next'
import { BackLink } from '@/components/BackLink'

export const metadata: Metadata = {
  title: 'Política de privacidade — Anota Aí Agro',
  description: 'Quais dados o Anota Aí Agro guarda, para que servem, com quem são compartilhados e como pedir a exclusão da conta.',
}

// Página aberta (sem login), exigida pela Play Store e pela LGPD. O endereço /privacidade#excluir é o que se informa
// no Play Console em "Exclusão de dados". Mantenha o texto fiel ao que o app faz: o Google confere na revisão.

const ATUALIZADA_EM = '5 de novembro de 2026'
const EMAIL = 'anotaaiagro@gmail.com'

const H2 = 'mt-8 text-lg font-bold text-gray-900'
const P = 'mt-2 text-sm leading-relaxed text-gray-700'
const UL = 'mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700'

export default function PrivacidadePage() {
  const email = <a href={`mailto:${EMAIL}`} className="font-semibold text-green-700 hover:underline">{EMAIL}</a>
  return (
    <article className="mx-auto max-w-3xl">
      <BackLink href="/inicio" label="Voltar ao início" className="mb-2 -ml-2" />
      <h1 className="text-2xl font-bold text-gray-900">Política de privacidade</h1>
      <p className="mt-1 text-sm text-gray-500">Anota Aí Agro · atualizada em {ATUALIZADA_EM}</p>

      <p className={P}>
        O Anota Aí Agro é um aplicativo para anotar o dia a dia de sítios e fazendas: leite, rebanho, vacinas, dinheiro e estoque.
        Esta página explica, em linguagem simples, quais dados guardamos, para que servem, com quem são compartilhados e como você
        pode ver, corrigir ou apagar o que é seu. Ela vale para o site <strong>www.anotaaiagro.com.br</strong>, para o aplicativo
        Android e para o Anota Aí Leite.
      </p>

      <h2 id="dados" className={H2}>Quais dados guardamos</h2>
      <ul className={UL}>
        <li><strong>Dados da conta:</strong> nome, e-mail ou telefone, e a senha, guardada de forma embaralhada (não conseguimos lê-la). Quem entra com a conta Google nos envia o nome, o e-mail e um código de identificação do Google; não recebemos a senha do Google.</li>
        <li><strong>Dados da propriedade:</strong> tudo o que você anota no app: animais, produção de leite, vacinas e tratamentos, lançamentos financeiros, estoque, propriedades, pessoas da equipe e fornecedores.</li>
        <li><strong>Mensagens de suporte e contato:</strong> o que você escreve no formulário de contato ou no WhatsApp de suporte.</li>
        <li><strong>Lançamento pelo WhatsApp:</strong> se você mandar uma anotação pelo WhatsApp, guardamos o número de origem e o texto da mensagem para anotar na sua propriedade e responder.</li>
        <li><strong>Dados técnicos:</strong> registros do servidor com data, endereço de rede e tela acessada, usados para manter o serviço funcionando e investigar erros.</li>
      </ul>
      <p className={P}>Não pedimos CPF, dados bancários, cartão nem localização.</p>

      <h2 id="aparelho" className={H2}>Recursos do seu aparelho</h2>
      <ul className={UL}>
        <li><strong>Microfone:</strong> só quando você toca em “Falar o número”, para reconhecer a quantidade dita. O reconhecimento pode usar o serviço de voz do próprio aparelho ou do navegador, ou um pacote de voz baixado uma única vez e que funciona sem internet. Não gravamos nem guardamos o áudio.</li>
        <li><strong>Câmera:</strong> só quando você fotografa a folha do motorista para ler os litros. A leitura é feita no aparelho; quando ela não é possível, a foto é enviada ao nosso servidor e ao serviço de leitura de imagens do Google (Cloud Vision) apenas para extrair o texto, e não é guardada por eles. A foto só fica guardada se você salvar a folha.</li>
        <li><strong>Armazenamento no aparelho:</strong> guardamos uma cópia das suas telas e anotações no celular para o app abrir e funcionar sem internet. Essa cópia fica só no seu aparelho e é apagada ao sair da conta ou desinstalar o app.</li>
      </ul>

      <h2 id="uso" className={H2}>Para que usamos os dados</h2>
      <ul className={UL}>
        <li>Mostrar e guardar as suas anotações e permitir que a sua equipe, com a permissão que você der, veja a mesma propriedade.</li>
        <li>Identificar você ao entrar, inclusive pelo telefone quando anota pelo WhatsApp.</li>
        <li>Responder às suas mensagens de suporte e contato.</li>
        <li>Manter o serviço no ar, corrigir erros e evitar uso indevido.</li>
      </ul>
      <p className={P}>Não vendemos os seus dados, não usamos para publicidade e não mostramos anúncios.</p>

      <h2 id="compartilhamento" className={H2}>Com quem compartilhamos</h2>
      <p className={P}>Só com quem precisa para o serviço funcionar, e apenas o necessário:</p>
      <ul className={UL}>
        <li><strong>Pessoas que você autoriza:</strong> membros da sua propriedade, e, se você usar essas funções, o laticínio, a associação ou o fornecedor com quem você se vincula no app veem apenas o que a função mostra (por exemplo, os litros coletados).</li>
        <li><strong>Hospedagem e banco de dados:</strong> Vercel, onde o site e o banco de dados ficam guardados.</li>
        <li><strong>Google:</strong> para entrar com a conta Google e, quando você fotografa a folha, para a leitura do texto da imagem.</li>
        <li><strong>Meta (WhatsApp):</strong> quando você usa o lançamento pelo WhatsApp, as mensagens passam pela plataforma oficial do WhatsApp.</li>
        <li><strong>Envio de e-mail:</strong> o serviço de e-mail que entrega as mensagens do formulário de contato.</li>
      </ul>
      <p className={P}>Podemos ainda fornecer dados quando a lei exigir ou por ordem de autoridade competente.</p>

      <h2 id="guarda" className={H2}>Por quanto tempo guardamos</h2>
      <p className={P}>
        Enquanto a sua conta existir. Quando você pede a exclusão, a conta e as anotações da sua propriedade são apagadas em até 30 dias,
        exceto o que a lei nos obrigue a manter. Cópias de segurança são descartadas no ciclo normal, em até 90 dias.
      </p>

      <h2 id="direitos" className={H2}>Os seus direitos</h2>
      <p className={P}>
        Pela Lei Geral de Proteção de Dados (LGPD), você pode a qualquer momento confirmar quais dados temos sobre você, pedir acesso,
        correção, cópia ou exclusão, e revogar um consentimento. Nome, e-mail e telefone você mesmo altera em “Meu cadastro” no app.
        Para o restante, escreva para {email}. Respondemos em até 15 dias.
      </p>

      <h2 id="excluir" className={H2}>Como excluir a sua conta</h2>
      <p className={P}>Para apagar a conta e todos os dados ligados a ela:</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-gray-700">
        <li>Envie um e-mail para {email} com o assunto <strong>“Excluir minha conta”</strong>, a partir do e-mail cadastrado, ou informando o telefone cadastrado.</li>
        <li>Confirmamos o pedido por resposta ao mesmo e-mail, para garantir que foi você quem pediu.</li>
        <li>Em até 30 dias a conta, as anotações da sua propriedade e as mensagens são apagadas. Se outras pessoas usam a mesma propriedade, apagamos só o seu acesso e os seus dados pessoais, e os registros da propriedade continuam com elas.</li>
      </ol>
      <p className={P}>Se quiser apagar só parte dos dados, por exemplo as anotações de leite, diga isso no e-mail.</p>

      <h2 id="criancas" className={H2}>Crianças e adolescentes</h2>
      <p className={P}>O Anota Aí Agro é feito para quem trabalha na produção rural e não se destina a menores de 18 anos. Não criamos contas conscientemente para menores; se souber de uma, avise que apagamos.</p>

      <h2 id="seguranca" className={H2}>Segurança</h2>
      <p className={P}>A conexão com o site é protegida (HTTPS), as senhas ficam embaralhadas e o acesso aos dados é restrito a quem tem permissão na sua propriedade. Nenhum sistema é totalmente à prova de falhas; se identificarmos um incidente que afete os seus dados, avisaremos você e as autoridades conforme a lei.</p>

      <h2 id="alteracoes" className={H2}>Mudanças nesta política</h2>
      <p className={P}>Quando mudarmos algo relevante, atualizaremos a data no alto desta página e avisaremos no app. A versão em vigor é sempre a publicada aqui.</p>

      <h2 id="contato" className={H2}>Contato</h2>
      <p className={P}>Responsável pelo tratamento dos dados: Anota Aí Agro. Dúvidas, pedidos e reclamações sobre privacidade: {email}.</p>
    </article>
  )
}
