# Portfólio CCOP — Edeconsil

Site estático do portfólio da **Coordenação de Controle Operação e Produção (CCOP)** da Edeconsil.
Página única com três vistas: portfólio do setor, projeto **TEMPUS** e projeto **RATCHET**.

Não tem build, não tem dependência de `npm`. É HTML, CSS e JavaScript servidos direto.

---

## Publicar

**Endereço do site:** <https://airtonosj.github.io/ccop-portfolio/>

O workflow em `.github/workflows/deploy.yml` publica a cada `push` na `main`:

```bash
git push
```

Também dá para rodar à mão em **Actions → Publicar no GitHub Pages → Run workflow**.

Se o Pages ainda não estiver ligado: **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

### Se trocar o endereço

Renomear o repositório ou apontar um domínio próprio muda a URL. Nesse caso atualize:

| Arquivo | O que contém |
| --- | --- |
| `index.html` | `canonical`, `og:url`, `og:image` (bloco comentado no `<head>`) |
| `robots.txt` | linha `Sitemap:` |
| `sitemap.xml` | as quatro tags `<loc>` |

> Este repositório é **público** — os nomes dos responsáveis pelas atividades e o
> endereço do TEMPUS ficam visíveis. Para ocultar os nomes sem mexer no conteúdo,
> passe a prop `mostrarResponsaveis` como `false`: os cartões passam a exibir
> "CCOP" no lugar da pessoa.

---

## Testar antes de publicar

O site **precisa ser servido por HTTP** — abrir `index.html` com duplo clique (`file://`)
não funciona, porque o runtime lê o próprio HTML via `fetch`.

```bash
python -m http.server 8000
```

Depois abra <http://localhost:8000>.

---

## Modo apresentação (telão do escritório)

Acrescente `?tv=1` ao endereço e o site passa a se apresentar sozinho: percorre
cada tela de cima a baixo, parando alguns segundos por altura de janela para dar
tempo de leitura, e ao terminar passa para a próxima — em ciclo infinito.

<https://airtonosj.github.io/ccop-portfolio/?tv=1>

Sem o `?tv=1` nada muda: o `apresentacao.js` sai na primeira linha.

### Parâmetros

| Parâmetro | Padrão | O que faz |
| --- | --- | --- |
| `tv` | — | Liga o modo. Só a presença basta (`?tv=1`). |
| `seg` | `7` | Segundos parado em cada altura de tela. `?tv=1&seg=10` deixa mais lento. |
| `telas` | `home,tempus,ratchet` | Quais telas entram no ciclo e em que ordem. Ex.: `?tv=1&telas=tempus,ratchet`. |

### Controles

Pensado para ficar sozinho, mas atende quem chega perto:

| Ação | Efeito |
| --- | --- |
| Qualquer clique, rolagem ou tecla | Pausa por 45s e volta sozinho |
| Espaço | Pausa/retoma sem tempo limite |
| ← → | Tela anterior / próxima |

O cursor do mouse desaparece após 4s parado. O ponteiro de progresso no canto
inferior direito mostra a tela atual e a barra no topo, a posição na tela.

### Deixando no ar em um Windows

Chrome em modo quiosque (tela cheia, sem barra de endereço):

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --incognito --noerrdialogs --disable-session-crashed-bubble "https://airtonosj.github.io/ccop-portfolio/?tv=1"
```

Para subir junto com o Windows, crie um atalho com essa linha e coloque-o em
`shell:startup` (Win+R → `shell:startup`). Vale desligar a suspensão do monitor
nas opções de energia — o modo apresentação pede o *wake lock* do navegador,
mas ele não é garantido em toda configuração.

Sair do quiosque: `Alt`+`F4`.

---

## O que falta preencher

| Pendência | Onde |
| --- | --- |
| Endereço definitivo do TEMPUS | `index.html`, constante `TEMPUS_URL` (um único lugar) |
| Link do sistema Ratchet | `index.html`, o texto "Link do sistema — a definir" na vista do Ratchet |

Para trocar um print de sistema, basta sobrescrever o arquivo em `assets/`
mantendo o nome. As molduras usam `object-fit: contain`, então qualquer
proporção funciona sem distorcer.

---

## Estrutura

```
.
├── index.html          página única (template + estado + lógica)
├── apresentacao.js     modo telão, inerte sem ?tv=1 na URL
├── support.js          runtime de componentes (não editar)
├── vendor/             React 18.3.1 + ReactDOM UMD, vendorizados
├── assets/             logo, ícones, capa social e prints dos sistemas
├── downloads/          manuais em PDF
├── 404.html            página de erro
├── robots.txt
├── sitemap.xml
├── .nojekyll           desliga o Jekyll no GitHub Pages
└── .github/workflows/deploy.yml
```

### Por que `vendor/`

`support.js` busca React em `unpkg.com` **só se `window.React` ainda não existir**
(`support.js:1838`). O `index.html` carrega as cópias locais antes dele, então o site
renderiza sem depender de CDN externo — importante em rede corporativa com saída restrita.
Os dois arquivos foram verificados por SRI contra os hashes que já constam no `support.js`.

### Dependência externa que sobrou

As fontes vêm do Google Fonts (`fonts.googleapis.com`). Se o acesso for bloqueado, o site
continua funcionando com as fontes de sistema — a degradação é apenas tipográfica.
Para eliminar isso também, baixe os `.woff2` de Archivo e IBM Plex Sans/Mono, coloque em
`assets/fonts/` e troque o `<link>` do Google por `@font-face` locais.

---

## Notas técnicas

- **Rotas por hash** — `#/tempus` e `#/ratchet` têm endereço próprio: o link pode ser
  compartilhado, o F5 mantém a página e o "voltar" do navegador funciona.
- **Renderização no cliente** — o conteúdo é montado por JavaScript. Há um `<noscript>`
  com o resumo do setor e os links dos manuais para quem estiver sem JS.
- **Não foram publicados** a pasta `uploads/` (≈7 MB de duplicatas dos arquivos que já
  estão em `assets/` e `downloads/`), o `.thumbnail` e o `image-slot.js` — este último é
  ferramenta de edição do editor de design e não tem função em produção.
