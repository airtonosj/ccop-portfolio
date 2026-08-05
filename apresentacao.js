/* ===========================================================================
   MODO APRESENTAÇÃO (telão do escritório)
   ---------------------------------------------------------------------------
   Ativa só com ?tv=1 na URL. Sem esse parâmetro o arquivo sai na primeira
   linha e o site se comporta exatamente como antes.

     https://airtonosj.github.io/ccop-portfolio/?tv=1
     https://airtonosj.github.io/ccop-portfolio/?tv=1&seg=10   (10s por tela cheia)
     https://airtonosj.github.io/ccop-portfolio/?tv=1&telas=tempus,ratchet

   O laço percorre cada tela de cima a baixo em passos de ~85% da altura da
   janela, para alguns segundos em cada passo para dar tempo de leitura, e ao
   chegar no fim passa para a tela seguinte, em ciclo infinito.

   Troca de tela: o componente do index.html já escuta `popstate` e lê a tela
   do hash, então aqui basta reescrever a URL e disparar o evento à mão — não
   é preciso acoplar nada ao componente. Usa replaceState, e não pushState,
   porque o laço roda por horas e o histórico não deve crescer sem limite.

   Interação humana pausa o laço (alguém chegou perto para olhar); ele volta
   sozinho depois de um tempo. Espaço alterna pausa fixa; setas avançam ou
   voltam de tela.

   Nos botões "Abrir o sistema" (TEMPUS e RATCHET) o clique não navega: mostra o
   endereço no centro da tela — ver `protegerLinksExternos`.
   =========================================================================== */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  if (!params.has('tv')) return;

  // ---------------------------------------------------------------- ajustes
  var SEG_POR_PASSO = Math.max(2, parseInt(params.get('seg') || '7', 10));
  var PAUSA_APOS_INTERACAO_MS = 45000;
  var PASSO_DA_JANELA = 0.85;

  var TELAS = (params.get('telas') || 'home,tempus,ratchet')
    .split(',').map(function (s) { return s.trim(); })
    .filter(function (s) { return ['home', 'tempus', 'ratchet'].indexOf(s) >= 0; });
  if (!TELAS.length) TELAS = ['home', 'tempus', 'ratchet'];

  var ROTULOS = { home: 'Portfólio do setor', tempus: 'TEMPUS', ratchet: 'RATCHET' };

  // ------------------------------------------------------------------ estado
  var pausaFixa = false;
  var pausadoAte = 0;
  var indiceTela = 0;
  var pularTela = 0;   // -1 volta, +1 avança, mexido pelas setas

  function esperar(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function emPausa() {
    return pausaFixa || Date.now() < pausadoAte;
  }

  /* Só devolve o controle quando não há pausa em curso. */
  function portao() {
    return new Promise(function (resolve) {
      (function checar() {
        if (!emPausa()) return resolve();
        setTimeout(checar, 250);
      })();
    });
  }

  /* Espera fatiada: se alguém interagir no meio, a contagem congela em vez de
     seguir correndo por baixo da pausa.
     Desconta tempo de relógio, e não número de ticks: o navegador estrangula
     setTimeout em aba de fundo (mínimo de ~1s), e contar ticks faria a parada
     durar vários minutos em vez dos segundos configurados. */
  function esperarComPausa(ms) {
    return new Promise(function (resolve) {
      var restante = ms;
      var ultimo = Date.now();
      (function tique() {
        if (pularTela) return resolve();
        var agora = Date.now();
        if (!emPausa()) restante -= (agora - ultimo);
        ultimo = agora;
        if (restante <= 0) return resolve();
        setTimeout(tique, 150);
      })();
    });
  }

  // ------------------------------------------------------------- navegação
  function irParaTela(nome) {
    var base = location.pathname + location.search;
    var url = nome === 'home' ? base : base + '#/' + nome;
    history.replaceState(null, '', url);
    // replaceState/pushState não emitem popstate; o componente escuta esse
    // evento, então disparamos explicitamente.
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  function alturaRolavel() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  /* Rolagem animada por conta própria, em vez de scrollTo({behavior:'smooth'}).
     Motivo: o 'smooth' do navegador depende do compositor e é ignorado quando
     a máquina está com "prefers-reduced-motion: reduce" — num telão isso
     deixaria o painel congelado no topo, mostrando só o hero, sem nenhum erro
     aparente. Um tween sobre scrollTo instantâneo funciona em qualquer caso. */
  function rolarSuave(destino, duracao) {
    return new Promise(function (resolve) {
      var inicio = window.scrollY;
      var delta = destino - inicio;
      if (Math.abs(delta) < 2) { window.scrollTo(0, destino); return resolve(); }
      var t0 = Date.now();
      (function passo() {
        // Abandona o tween se alguém pediu outra tela pelas setas — sem isso a
        // troca só aconteceria depois da rolagem terminar.
        if (pularTela) return resolve();
        var t = Math.min(1, (Date.now() - t0) / duracao);
        var suavizado = 0.5 - Math.cos(Math.PI * t) / 2;   // ease-in-out
        window.scrollTo(0, Math.round(inicio + delta * suavizado));
        if (t >= 1) return resolve();
        setTimeout(passo, 16);
      })();
    });
  }

  /* As animações de entrada dependem de IntersectionObserver + rAF. Num
     painel que fica ligado sem ninguém olhando, qualquer falha ali deixaria
     bloco em branco no telão. Esta rede revela o que já deveria estar
     visível, preservando a animação do conteúdo ainda abaixo da dobra. */
  function redeDeSeguranca() {
    var h = window.innerHeight;
    document.querySelectorAll('[data-reveal]:not(.om-in)').forEach(function (el) {
      if (el.getBoundingClientRect().top < h * 0.95) el.classList.add('om-in');
    });
  }

  /* Endereço curto, para caber no aviso central sem virar um parágrafo. */
  function endereco(href) {
    try {
      var u = new URL(href);
      return u.host + (u.pathname === '/' ? '' : u.pathname);
    } catch (e) {
      return href;
    }
  }

  /* Gatilhos por tela: coisas que valem ser acionadas sozinhas para o telão
     mostrar o sistema em funcionamento, não uma tela estática. */
  function gatilhos(tela) {
    if (tela !== 'ratchet') return;
    var b = document.querySelector('[data-tv="analise"]');
    if (!b) return;
    var r = b.getBoundingClientRect();
    var naTela = r.top < window.innerHeight * 0.9 && r.bottom > 0;
    // roda a análise quando o botão aparece; se já rodou, deixa como está
    if (naTela && /Rodar/i.test(b.textContent)) b.click();
  }

  // -------------------------------------------------------------- interface
  var barra, pilula, textoPilula, pontos = [], aviso;

  function montarInterface() {
    var css = document.createElement('style');
    css.textContent = [
      '#tv-barra{position:fixed;top:0;left:0;height:3px;width:0;z-index:9999;',
      '  background:linear-gradient(90deg,#FFC400,#FFD54A);transition:width .35s linear;pointer-events:none}',
      '#tv-pilula{position:fixed;bottom:22px;right:22px;z-index:9999;display:flex;align-items:center;gap:14px;',
      '  padding:11px 17px;border-radius:999px;background:rgba(11,15,61,.86);backdrop-filter:blur(10px);',
      '  border:1px solid rgba(255,196,0,.32);color:#fff;pointer-events:none;',
      "  font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:11.5px;letter-spacing:.12em;text-transform:uppercase}",
      '#tv-pilula .pt{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.28);transition:background .3s}',
      '#tv-pilula .pt.on{background:#FFC400}',
      '#tv-aviso{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;',
      '  padding:20px 34px;border-radius:8px;background:rgba(11,15,61,.94);border:1px solid rgba(255,196,0,.45);',
      "  color:#FFC400;font-family:'Archivo',system-ui,sans-serif;font-weight:700;font-size:19px;",
      '  letter-spacing:.04em;opacity:0;transition:opacity .25s;pointer-events:none;',
      '  max-width:80vw;text-align:center;line-height:1.45;overflow-wrap:anywhere}',
      '#tv-aviso.on{opacity:1}',
      /* Num telão ninguém toca na tela nem arrasta tabela. */
      '.r-burger,.r-table-hint{display:none !important}'
    ].join('');
    document.head.appendChild(css);

    barra = document.createElement('div');
    barra.id = 'tv-barra';

    pilula = document.createElement('div');
    pilula.id = 'tv-pilula';
    TELAS.forEach(function () {
      var d = document.createElement('span');
      d.className = 'pt';
      pontos.push(d);
      pilula.appendChild(d);
    });
    textoPilula = document.createElement('span');
    pilula.appendChild(textoPilula);

    aviso = document.createElement('div');
    aviso.id = 'tv-aviso';

    document.body.appendChild(barra);
    document.body.appendChild(pilula);
    document.body.appendChild(aviso);
  }

  /* Recado passageiro no centro da tela. Tem prioridade sobre o aviso de pausa
     porque só aparece em resposta a alguém que acabou de tocar em algo. */
  var mensagem = '', mensagemAte = 0;
  function avisar(texto, ms) {
    mensagem = texto;
    mensagemAte = Date.now() + (ms || 7000);
    pintarInterface();
  }

  function pintarInterface() {
    var max = alturaRolavel();
    var prog = max > 0 ? Math.min(1, window.scrollY / max) : 1;
    barra.style.width = (prog * 100).toFixed(1) + '%';
    pontos.forEach(function (d, i) { d.classList.toggle('on', i === indiceTela % TELAS.length); });
    var nome = ROTULOS[TELAS[indiceTela % TELAS.length]] || '';
    textoPilula.textContent = emPausa() ? 'pausado' : nome;
    var comMensagem = Date.now() < mensagemAte;
    aviso.classList.toggle('on', comMensagem || pausaFixa);
    if (comMensagem) aviso.textContent = mensagem;
    else if (pausaFixa) aviso.textContent = 'Apresentação pausada — espaço para retomar';
  }

  // ------------------------------------------------------ pausa e interação
  function marcarInteracao() {
    pausadoAte = Date.now() + PAUSA_APOS_INTERACAO_MS;
  }

  var timerCursor;
  function mostrarCursor() {
    document.documentElement.style.cursor = '';
    clearTimeout(timerCursor);
    timerCursor = setTimeout(function () {
      document.documentElement.style.cursor = 'none';
    }, 4000);
  }

  function ligarEventos() {
    ['click', 'wheel', 'touchstart', 'keydown'].forEach(function (ev) {
      window.addEventListener(ev, marcarInteracao, { passive: true });
    });
    window.addEventListener('mousemove', function () {
      mostrarCursor();
      marcarInteracao();
    }, { passive: true });

    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space') {
        e.preventDefault();
        pausaFixa = !pausaFixa;
        if (!pausaFixa) pausadoAte = 0;
      } else if (e.code === 'ArrowRight') {
        pularTela = 1;
      } else if (e.code === 'ArrowLeft') {
        pularTela = -1;
      }
    });

    mostrarCursor();
  }

  /* Em quiosque, clicar em "Abrir o sistema" abre o TEMPUS ou o RATCHET numa
     aba em cima da apresentação — e não há barra de endereço nem como fechá-la
     sem teclado. O telão fica preso no sistema indefinidamente, sem que o cão
     de guarda possa socorrer: naquela aba este script não roda. Por isso o
     clique não navega; mostra o endereço, que é o que interessa a quem tocou.
     Captura na descida para decidir antes de qualquer handler do componente. */
  function protegerLinksExternos() {
    document.addEventListener('click', function (e) {
      var alvo = e.target;
      var a = alvo && alvo.closest ? alvo.closest('a[target="_blank"]') : null;
      if (!a) return;
      // Só o `preventDefault`: o evento segue subindo para que `marcarInteracao`
      // registre a presença de alguém e o laço pause como em qualquer clique.
      e.preventDefault();
      avisar('Acesse pelo computador: ' + endereco(a.href));
    }, true);
  }

  /* Impede o monitor de dormir. Falha silenciosamente onde não há suporte ou
     permissão — a apresentação segue, só sem garantia de tela acesa. */
  var trava = null;
  function travarTela() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (t) {
      trava = t;
      t.addEventListener('release', function () { trava = null; });
    }).catch(function () { /* sem permissão: segue sem travar */ });
  }

  // ------------------------------------------------------------------- laço
  async function percorrerTela(tela) {
    var passo = Math.max(200, Math.round(window.innerHeight * PASSO_DA_JANELA));
    var y = 0;
    var guarda = 0;

    while (guarda++ < 60) {
      await portao();
      if (pularTela) return;

      await rolarSuave(y, 900);
      redeDeSeguranca();
      gatilhos(tela);
      ultimoAvanco = Date.now();   // sinal de vida a cada passo, não por tela

      await esperarComPausa(SEG_POR_PASSO * 1000);
      if (pularTela) return;

      var max = alturaRolavel();
      if (y >= max) break;
      y = Math.min(y + passo, max);
    }
  }

  /* Marca de vida, lida pelo cão de guarda. */
  var ultimoAvanco = Date.now();

  async function laco() {
    while (true) {
      /* O try/catch é o que impede o telão de congelar: sem ele, uma única
         exceção encerraria este laço infinito em silêncio e a tela ficaria
         parada até alguém notar. Aqui um erro custa um ciclo, não a
         apresentação inteira. */
      try {
        var tela = TELAS[((indiceTela % TELAS.length) + TELAS.length) % TELAS.length];
        irParaTela(tela);
        await esperar(900);        // espera o React montar a tela
        redeDeSeguranca();

        await percorrerTela(tela);
      } catch (e) {
        if (window.console) console.error('[tv] falha no ciclo, seguindo:', e);
        await esperar(2000);
      }

      if (pularTela) {
        indiceTela += pularTela;
        pularTela = 0;
      } else {
        indiceTela += 1;
      }
      ultimoAvanco = Date.now();
    }
  }

  /* Cão de guarda: um painel de escritório fica dias ligado sem ninguém por
     perto. Se o ciclo parar de avançar — erro fora do try, aba suspensa que
     não retomou, runtime quebrado — recarregar é melhor que exibir uma tela
     estática indefinidamente. */
  function caoDeGuarda() {
    var LIMITE_MS = 6 * 60 * 1000;
    setInterval(function () {
      if (emPausa()) { ultimoAvanco = Date.now(); return; }   // pausa não é travamento
      if (Date.now() - ultimoAvanco > LIMITE_MS) location.reload();
    }, 30000);
  }

  // ------------------------------------------------------------------ start
  function iniciar() {
    montarInterface();
    ligarEventos();
    protegerLinksExternos();
    travarTela();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && !trava) travarTela();
    });
    setInterval(pintarInterface, 300);
    setInterval(redeDeSeguranca, 1500);
    window.addEventListener('scroll', pintarInterface, { passive: true });
    caoDeGuarda();
    laco();
  }

  // O componente precisa ter montado (o #dc-root só existe depois do boot).
  function esperarOSite(tentativas) {
    if (document.querySelector('#dc-root main')) return iniciar();
    if (tentativas <= 0) return iniciar();   // segue mesmo assim
    setTimeout(function () { esperarOSite(tentativas - 1); }, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { esperarOSite(50); });
  } else {
    esperarOSite(50);
  }
})();
