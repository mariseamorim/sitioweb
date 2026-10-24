# Administrador: contas e senhas

Em Administração > Contas e senhas, o administrador vê todas as contas do sistema, de todos os perfis: administrador, editor e leitor da propriedade, fornecedor, laticínio, associação, Anota Aí Leite (produtor lite e motorista) e cadastros incompletos. É a saída para quem esqueceu a senha e para corrigir um telefone ou e-mail digitado errado.

## O que a tela faz

- Busca por nome, telefone (com ou sem pontuação), e-mail, propriedade ou empresa, sem diferenciar acentos. Filtro por perfil.
- Cada conta mostra o perfil, o contato, a propriedade/empresa/organização, se entra com Google e se ainda não tem senha.
- "Editar e senha" abre nome, telefone, e-mail e "Nova senha". Só o que mudou é enviado.
- "Gerar senha" sugere 8 letras e números fáceis de ditar (sem 0/O e 1/l/I). Depois de salvar, a senha aparece uma vez num aviso para o administrador enviar à pessoa; ela troca depois em Meu cadastro.

## Regras

- Só o administrador (`requireAdmin`). A senha nova não exige a atual: é o reset.
- Nome não pode ficar vazio; telefone ou e-mail, pelo menos um; nem um nem outro pode já estar em outra conta.
- Senha com no mínimo 6 caracteres, guardada com o mesmo hash do cadastro (`hashPassword`).
- Fornecedor: nome e e-mail do contato da empresa acompanham a conta, como em Meu cadastro.
- Perfil e permissões não mudam por aqui: a equipe da propriedade continua em Usuários, e a aprovação de fornecedor e organização nas telas próprias.

## Código

- `src/lib/adminAccounts.ts`: o que a lista mostra (a senha vira só "tem senha").
- `src/lib/roles.ts`: nome de cada perfil.
- `src/app/api/admin/usuarios/route.ts` (lista) e `src/app/api/admin/usuarios/[id]/route.ts` (alteração).
- `src/app/admin/usuarios/page.tsx`: a tela.
