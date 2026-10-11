# Formulário de contato

O formulário envia via Gmail no servidor. O destinatário fica somente na API; não é publicado no HTML ou JavaScript do navegador. A resposta ao e-mail recebido usa o endereço do visitante (Reply-To).

## Ativação

1. Na conta Google que enviará as mensagens, ative a verificação em duas etapas e crie uma senha de aplicativo: https://support.google.com/accounts/answer/185833?hl=pt-BR . Algumas contas não oferecem essa opção.
2. Adicione as duas variáveis de .env.contact.example ao .env.local do servidor ou ao gerenciador de segredos da hospedagem. Não compartilhe a senha no chat, não use variáveis NEXT_PUBLIC_ e não versione o arquivo .env.local.
3. Reinicie o servidor e faça um envio de teste pelo formulário. Confira a caixa de entrada e o spam do destinatário.

Sem credenciais, a API retorna 503 e o formulário informa indisponibilidade; nenhuma mensagem de sucesso é exibida. Sucesso significa que o SMTP aceitou a mensagem, não garantia de entrega na caixa de entrada.

Há validação, campo antispam, verificação de origem e limite de 20 tentativas a cada 10 minutos por processo. Para múltiplas instâncias ou tráfego maior, use limitação compartilhada e proteção antispam na hospedagem. O Gmail pode restringir envios automatizados; para produção com volume maior, use um serviço transacional.

Referência SMTP: https://nodemailer.com/smtp
