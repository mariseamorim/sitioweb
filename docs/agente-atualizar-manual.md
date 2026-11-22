# Script de Agente — Atualização Automática do Manual Visual (Anota Aí Agro)

Use este arquivo como instrução direta para o agente sempre que houver atualização no app Android (`mobile/`) e for necessário recapturar as telas reais e atualizar o manual do usuário final (`public/manual/campos-editaveis.html` e `docs/manual-campos-editaveis.md`).

---

## 1. Pré-requisitos e Ambiente Android (Windows)

1. **Emulador obrigatório:** usar o AVD **`Pixel_10_Pro`** (`1280x2856`, proporção real de celular).
   - **Não** usar `Pixel_Fold` (tela larga/quadrada gera capturas desproporcionais).
   - Iniciar com boot limpo:
     ```powershell
     & "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_10_Pro -no-snapshot-load
     ```
2. **Compilação do APK para o emulador (`x86_64`):**
   - APKs de loja (`arm64-v8a`) fecham no emulador `x86_64` com `couldn't find DSO to load: libreactnative.so`.
   - Sempre compilar para `x86_64` a partir de `mobile/`:
     - `npm install --legacy-peer-deps`
     - `npx --yes expo prebuild --platform android --clean`
     - No `mobile/android/app/build.gradle`:
       - Dentro de `android {`: `externalNativeBuild { cmake { buildStagingDirectory "C:/a"; version "3.31.0" } }`
       - Dentro de `defaultConfig {`: `externalNativeBuild { cmake { arguments "-DCMAKE_MAKE_PROGRAM=<caminho-ninja-1.13+>", "-DCMAKE_OBJECT_PATH_MAX=160" } }`
     - Executar:
       ```powershell
       $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
       $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
       .\gradlew.bat assembleRelease -PreactNativeArchitectures=x86_64 --max-workers=2
       ```
   - Instalar no emulador após `sys.boot_completed = 1` e `pm path android`:
     ```powershell
     & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r "mobile\android\app\build\outputs\apk\release\app-release.apk"
     ```

---

## 2. Login Automático e Captura das Telas Reais

1. Abrir `br.com.anotaaiagro.app/.MainActivity`.
2. Usar `uiautomator dump /data/local/tmp/ui.xml` para obter as coordenadas exatas dos `EditText` e do botão `Entrar` (nunca chutar coordenadas fixas).
3. Ao digitar no emulador:
   - Tocar no campo, aguardar `1s`, usar `adb shell input text`, aguardar `1s` e enviar `keyevent 111` (ESC) para fechar o teclado antes de tocar no próximo campo ou botão.
4. **Conta padrão de demonstração/validação:** `produtor@demo.com` / `Demo-cZqAz8qsjULe`.
5. **Captura por rota (deep link Expo Router com 3 barras `anotaaiagro:///...`):**
   - Sempre enviar `keyevent 111` após abrir a rota para garantir que nenhum teclado fique sobreposto aos campos.
   - Salvar em `public/manual/screens/` usando `adb shell screencap -p /data/local/tmp/s.png` e `adb pull` (nunca usar `>` do PowerShell com `exec-out`, pois corrompe PNG em UTF-16).

### Mapeamento Base das Telas (Expansível)
> **Regra de descoberta dinâmica:** Antes de capturar, listar **todas** as rotas com campos editáveis em `mobile/app/` e `mobile/src/ui/` (`Field`, `SelectField`, `DateField`, `Chips`, `TextInput`, `Switch`). Se houver qualquer módulo, tela ou campo novo que ainda não esteja na tabela abaixo, **incluir automaticamente** o novo passo, o filtro no topo (se for novo módulo), a captura real em `public/manual/screens/` e a numeração correspondente no manual — nunca limitar a quantidade fixa de passos.

| Passo | Arquivo de saída | Como abrir no app |
|---|---|---|
| 1 | `tela-01-perfil.png` | `anotaaiagro:///perfil` |
| 2 | `tela-02-propriedades.png` | `anotaaiagro:///fazendas` → tocar em `Editar cadastro` |
| 3 | `tela-03-animais.png` | `anotaaiagro:///animais/novo` |
| 4 | `tela-04-leite.png` | `anotaaiagro:///leite/novo` |
| 5 | `tela-05-reproducao.png` | `anotaaiagro:///reproducao` → tocar em `+ Registrar` |
| 6 | `tela-06-diagnostico.png` | `anotaaiagro:///reproducao/diagnostico` |
| 7 | `tela-07-engorda.jpg` / `.png` | `anotaaiagro:///engorda/novo` (se usar modo *Só a quantidade*, tocar nessa opção antes do print) |
| 8 | `tela-08-tratamentos.png` / `tela-08b-vacinas.png` | `anotaaiagro:///tratamentos/novo` e `anotaaiagro:///vacinas/novo` |
| 9 | `tela-09-estoque.png` / `tela-09b-financeiro.png` | `anotaaiagro:///estoque/novo` e `anotaaiagro:///financeiro/novo` |
| 10 | `tela-10-relatorios.jpg` / `.png` | `anotaaiagro:///relatorios` (rolar até exibir seleção de relatório + Período + botão `Ver relatório`) |
| 11 | `tela-11-usuarios.png` | `anotaaiagro:///usuarios/novo` |

---

## 3. Regras Visuais Obrigatórias do Manual (`public/manual/campos-editaveis.html`)

1. **Apenas telas reais:** nunca usar mockups CSS ou ilustrações desenhadas; usar sempre as capturas reais dentro de `.phone-real`.
2. **Apenas círculos numerados sobre os campos (sem linha/borda vermelha):**
   - `.hl-box` deve ter `border: none; background: transparent;` — exibir **somente** o círculo vermelho numerado (`.hl-dot`) na borda direita do campo correspondente, para nunca sobrepor textos ou valores.
   - Cada número na imagem deve corresponder exatamente ao número do balão escuro (`.callout-pill`) e ao número do item em `PASSO A PASSO NA TELA:`.
   - Incluir também botões de ação finais relevantes na numeração (ex.: em *Registrar Cobertura*: `5` Mais detalhes, `6` Salvar, `7` Salvar e repetir; em *Estoque*: `5` Salvar; em *Relatórios*: `1` Escolha o relatório, `2` O Período, `3` Clicar em Ver relatório).
3. **Sem caminhos internos visíveis para o usuário final:**
   - `.file-tag { display: none; }` obrigatório.
   - Não mencionar nomes de arquivos (`.png`, `.jpg`, `.tsx`) nos textos de passo a passo ou dicas.
4. **Estrutura de cada cartão:**
   - Cabeçalho com badge verde (`Passo X`), perfil/módulo, título e resumo curto.
   - Esquerda: `.phone-real` com imagem + `.hl-dot`s + coluna `.callouts-col`.
   - Direita: `PASSO A PASSO NA TELA:` com tags `Obrigatório` / `Opcional` e caixa verde `💡 Dica prática:`.
   - Topo da página: filtros por módulo e botão `🖨️ Imprimir / Salvar PDF`.

---

## 4. Sincronização com o Manual Markdown e Validação Final

1. **Descoberta e sincronização de campos:** antes de editar o HTML, varrer `mobile/app/` e `mobile/src/ui/` para identificar **todas** as telas com campos editáveis, criar passos adicionais para módulos novos e atualizar `docs/manual-campos-editaveis.md` e o contador do filtro `Todas as telas (N)` em `public/manual/campos-editaveis.html`.
2. Renderizar `public/manual/campos-editaveis.html` em Chrome headless (`--headless=new --screenshot=...`) e abrir o HTML no navegador padrão.
3. Inspecionar visualmente a prévia gerada confirmando:
   - Proporção `Pixel_10_Pro` preservada em todas as telas;
   - Números `.hl-dot` alinhados aos campos corretos sem linhas vermelhas;
   - Zero caminhos de arquivo internos exibidos;
   - Todas as imagens carregando sem erro (`naturalWidth > 0`).
