// ============================================
// BASE Content Studio - App Principal
// ============================================

// Estado global
let state = {
  empresas: [],
  empresaAtual: null,
  conteudos: [],
  conteudoAtual: null,
  mesAtual: null,
  anoAtual: new Date().getFullYear(),
  tabAtiva: 'planejamento'
};

// Debounce para edição inline
let saveTimer = null;
function debounce(fn, delay = 1000) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(fn, delay);
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Configura rotas
  router
    .on('/', renderHome)
    .on('/cliente/:slug', renderVisaoAnual)
    .on('/cliente/:slug/mes/:mes', renderPostsMes)
    .start();
});

// ============================================
// TELA 1: SELEÇÃO DE CLIENTE
// ============================================

async function renderHome() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="topbar">
      <div class="topbar-logo">🎯 <span>BASE</span> Content Studio</div>
    </div>
    <div class="container">
      <div class="page-header">
        <h1>Seus Clientes</h1>
        <p>Selecione um cliente para gerenciar o conteúdo</p>
      </div>
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;

  state.empresas = await getEmpresas();

  // Buscar contagem de conteúdos para cada empresa
  const counts = await Promise.all(
    state.empresas.map(e => getConteudoCount(e.id))
  );

  const grid = document.createElement('div');
  grid.className = 'clients-grid';

  if (state.empresas.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-icon">🏢</div>
        <h3>Nenhum cliente cadastrado</h3>
        <p>Execute o SQL de setup no Supabase para adicionar clientes.</p>
      </div>
    `;
  } else {
    state.empresas.forEach((empresa, i) => {
      const cores = empresa.cores || {};
      const primaria = cores.primaria || '#6366F1';
      const inicial = empresa.nome.charAt(0).toUpperCase();
      
      const card = document.createElement('div');
      card.className = 'client-card';
      card.style.setProperty('--card-accent', primaria);
      card.onclick = () => router.navigate(`/cliente/${empresa.slug}`);
      
      const logoHtml = empresa.logo_url 
        ? `<img src="${empresa.logo_url}" class="client-card-logo" alt="${empresa.nome}" onerror="this.outerHTML='<div class=\\'client-card-icon\\'>${inicial}</div>'">`
        : `<div class="client-card-icon" style="color:${primaria}">${inicial}</div>`;
      
      card.innerHTML = `
        ${logoHtml}
        <h3>${empresa.nome}</h3>
        <div class="client-slug">@${empresa.slug}</div>
        <div class="client-stats">
          <div class="client-stat">
            <span class="num">${counts[i]}</span> conteúdos
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  const container = app.querySelector('.container');
  container.querySelector('.loading').replaceWith(grid);
}

// ============================================
// TELA 2: VISÃO ANUAL
// ============================================

async function renderVisaoAnual({ slug }) {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="topbar">
      <div class="topbar-logo">🎯 <span>BASE</span> Content Studio</div>
      <div class="breadcrumb">
        <a href="#/">Clientes</a>
        <span class="sep">›</span>
        <span class="current">Carregando...</span>
      </div>
    </div>
    <div class="container">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;

  const empresa = await getEmpresaBySlug(slug);
  if (!empresa) return router.navigate('/');
  
  state.empresaAtual = empresa;
  const cores = empresa.cores || {};
  const primaria = cores.primaria || '#6366F1';
  
  // Atualiza accent
  document.documentElement.style.setProperty('--accent', primaria);
  if (cores.secundaria) {
    document.documentElement.style.setProperty('--accent-secondary', cores.secundaria);
  }

  // Busca todos os conteúdos do ano
  const conteudos = await getConteudos(empresa.id, null, state.anoAtual);

  // Agrupa por mês
  const porMes = {};
  for (let m = 1; m <= 12; m++) porMes[m] = [];
  conteudos.forEach(c => {
    if (c.mes && porMes[c.mes]) porMes[c.mes].push(c);
  });

  app.querySelector('.breadcrumb .current').textContent = empresa.nome;

  const container = app.querySelector('.container');
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1 style="color:${primaria}">${empresa.nome}</h1>
          <p>Visão anual ${state.anoAtual} — ${conteudos.length} conteúdos planejados</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-sm" onclick="changeYear(-1)">◀</button>
          <span style="font-weight:700;font-size:18px;">${state.anoAtual}</span>
          <button class="btn btn-sm" onclick="changeYear(1)">▶</button>
        </div>
      </div>
    </div>
    <div class="months-grid" id="months-grid"></div>
  `;

  const grid = document.getElementById('months-grid');
  
  for (let m = 1; m <= 12; m++) {
    const posts = porMes[m];
    const total = posts.length;
    
    // Contagem por status
    const statusCounts = {};
    posts.forEach(p => {
      const s = p.status || 'ideia';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const card = document.createElement('div');
    card.className = 'month-card';
    card.onclick = () => router.navigate(`/cliente/${slug}/mes/${m}`);

    // Barra de progresso
    let progressHtml = '';
    if (total > 0) {
      const segments = Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
        const count = statusCounts[status] || 0;
        if (count === 0) return '';
        const pct = (count / total * 100).toFixed(1);
        return `<div class="progress-segment" style="width:${pct}%;background:${cfg.color}" title="${cfg.label}: ${count}"></div>`;
      }).join('');
      
      progressHtml = `
        <div class="progress-bar">${segments}</div>
        <div class="progress-legend">
          ${Object.entries(statusCounts).map(([s, c]) => {
            const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.ideia;
            return `<span class="progress-legend-item"><span class="progress-legend-dot" style="background:${cfg.color}"></span>${c}</span>`;
          }).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="month-card-header">
        <h3>${MESES[m - 1]}</h3>
        <span class="month-count">${total} posts</span>
      </div>
      ${total === 0 ? '<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">Nenhum conteúdo</div>' : progressHtml}
    `;
    grid.appendChild(card);
  }
}

function changeYear(delta) {
  state.anoAtual += delta;
  if (state.empresaAtual) {
    renderVisaoAnual({ slug: state.empresaAtual.slug });
  }
}

// ============================================
// TELA 3: POSTS DO MÊS
// ============================================

async function renderPostsMes({ slug, mes }) {
  const app = document.getElementById('app');
  mes = parseInt(mes);
  state.mesAtual = mes;

  app.innerHTML = `
    <div class="topbar">
      <div class="topbar-logo">🎯 <span>BASE</span> Content Studio</div>
      <div class="breadcrumb">
        <a href="#/">Clientes</a>
        <span class="sep">›</span>
        <a href="#/cliente/${slug}">...</a>
        <span class="sep">›</span>
        <span class="current">${MESES[mes - 1]}</span>
      </div>
    </div>
    <div class="container">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;

  let empresa = state.empresaAtual;
  if (!empresa || empresa.slug !== slug) {
    empresa = await getEmpresaBySlug(slug);
    if (!empresa) return router.navigate('/');
    state.empresaAtual = empresa;
  }

  const cores = empresa.cores || {};
  const primaria = cores.primaria || '#6366F1';
  document.documentElement.style.setProperty('--accent', primaria);

  // Atualiza breadcrumb
  app.querySelector('.breadcrumb a:nth-child(3)').textContent = empresa.nome;

  const conteudos = await getConteudos(empresa.id, mes, state.anoAtual);
  state.conteudos = conteudos;

  // Separa por aba
  const planejamento = conteudos.filter(c => ['ideia', 'planejado'].includes(c.status));
  const prontos = conteudos.filter(c => ['produzindo', 'pronto', 'enviado', 'aprovado'].includes(c.status));

  // Stats
  const statusCounts = {};
  conteudos.forEach(c => {
    const s = c.status || 'ideia';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  const container = app.querySelector('.container');
  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-row">
        <div>
          <h1>${MESES[mes - 1].toUpperCase()} — Planejamento</h1>
          <p>${empresa.nome} · ${state.anoAtual}</p>
        </div>
        <button class="btn btn-primary" onclick="openNovoConteudo()">➕ Novo Conteúdo</button>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-chip"><span class="stat-num">${conteudos.length}</span> total</div>
      ${Object.entries(statusCounts).map(([s, c]) => {
        const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.ideia;
        return `<div class="stat-chip">${cfg.emoji} <span class="stat-num">${c}</span> ${cfg.label}</div>`;
      }).join('')}
    </div>

    <div class="month-tabs">
      <button class="month-tab active" data-tab="planejamento" onclick="switchTab('planejamento')">📋 Planejamento (${planejamento.length})</button>
      <button class="month-tab" data-tab="prontos" onclick="switchTab('prontos')">✅ Prontos (${prontos.length})</button>
    </div>

    <div id="tab-planejamento" class="tab-content">
      ${renderPostsGrid(planejamento, 'planejamento')}
    </div>
    <div id="tab-prontos" class="tab-content" style="display:none;">
      ${renderPostsGrid(prontos, 'prontos')}
    </div>
  `;
}

function switchTab(tab) {
  state.tabAtiva = tab;
  
  // Atualiza botões
  document.querySelectorAll('.month-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  // Atualiza conteúdo
  document.querySelectorAll('.tab-content').forEach(el => {
    el.style.display = 'none';
  });
  document.getElementById(`tab-${tab}`).style.display = 'block';
}

function renderPostsGrid(posts, tipo) {
  if (posts.length === 0) {
    const msg = tipo === 'planejamento' 
      ? 'Nenhuma ideia ou planejamento ainda' 
      : 'Nenhum conteúdo em produção ou pronto';
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${tipo === 'planejamento' ? '💡' : '📦'}</div>
        <h3>${msg}</h3>
        <p>Clique em "Novo Conteúdo" para começar a planejar.</p>
      </div>
    `;
  }

  return `
    <div class="posts-grid">
      ${posts.map(post => {
        const statusCfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.ideia;
        const tipoEmoji = TIPO_EMOJI[post.tipo] || '📄';
        return `
          <div class="post-card" onclick="openPostDetail('${post.id}')">
            <div class="post-card-header">
              <span class="post-card-date">${formatDate(post.data_publicacao)}</span>
              <span class="badge badge-status ${post.status}">${statusCfg.emoji} ${statusCfg.label}</span>
            </div>
            <h4>${post.titulo || 'Sem título'}</h4>
            <div class="post-card-meta">
              <span class="badge badge-tipo">${tipoEmoji} ${post.tipo || 'post'}</span>
              ${post.badge ? `<span class="badge badge-custom">${post.badge}</span>` : ''}
            </div>
            ${post.descricao ? `<div class="post-card-desc">${post.descricao}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ============================================
// TELA 4: DETALHE DO POST (Modal)
// ============================================

async function openPostDetail(id) {
  const post = await getConteudoById(id);
  if (!post) return;
  state.conteudoAtual = post;

  const statusCfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.ideia;
  const tipoEmoji = TIPO_EMOJI[post.tipo] || '📄';

  // Prepara conteúdo das tabs
  const slides = post.slides || [];
  const promptsImagem = post.prompts_imagem || [];
  const promptsVideo = post.prompts_video || [];
  const midiaUrls = post.midia_urls || [];

  const slidesHtml = slides.length > 0 
    ? `<div class="slides-list">${slides.map(s => {
        const text = typeof s === 'string' ? s : (s.texto || s.content || JSON.stringify(s));
        return `<div class="slide-item"><p>${escapeHtml(text)}</p></div>`;
      }).join('')}</div>`
    : '<p style="color:var(--text-muted)">Nenhum slide definido</p>';

  const narrativaHtml = post.descricao 
    ? `<div class="content-block"><button class="copy-btn" onclick="copyToClipboard(document.getElementById('narrativa-text').innerText)">📋 Copiar</button><pre id="narrativa-text">${escapeHtml(post.descricao)}</pre></div>${slidesHtml}`
    : `<p style="color:var(--text-muted)">Nenhuma narrativa definida</p>${slidesHtml}`;

  const promptImgHtml = promptsImagem.length > 0
    ? promptsImagem.map((p, i) => {
        const text = typeof p === 'string' ? p : JSON.stringify(p, null, 2);
        return `<div class="content-block"><button class="copy-btn" onclick="copyToClipboard(this.nextElementSibling.innerText)">📋 Copiar</button><pre>${escapeHtml(text)}</pre></div>`;
      }).join('')
    : '<p style="color:var(--text-muted)">Nenhum prompt de imagem</p>';

  const promptVidHtml = promptsVideo.length > 0
    ? promptsVideo.map((p, i) => {
        const text = typeof p === 'string' ? p : JSON.stringify(p, null, 2);
        return `<div class="content-block"><button class="copy-btn" onclick="copyToClipboard(this.nextElementSibling.innerText)">📋 Copiar</button><pre>${escapeHtml(text)}</pre></div>`;
      }).join('')
    : '<p style="color:var(--text-muted)">Nenhum prompt de vídeo</p>';

  const legendaHtml = post.legenda
    ? `<div class="content-block"><button class="copy-btn" onclick="copyToClipboard(document.getElementById('legenda-text').innerText)">📋 Copiar</button><pre id="legenda-text">${escapeHtml(post.legenda)}</pre></div>`
    : '<p style="color:var(--text-muted)">Nenhuma legenda definida</p>';

  const midiaHtml = midiaUrls.length > 0
    ? `<div class="media-grid">${midiaUrls.map(url => `
        <div class="media-item">
          <img src="${url}" alt="Mídia" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%2250%25%22 x=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2230%22>📎</text></svg>'">
          <div class="media-item-overlay">
            <a href="${url}" target="_blank" class="btn btn-sm" style="background:white;color:black;">⬇ Abrir</a>
          </div>
        </div>
      `).join('')}
      <button class="add-media-btn" onclick="addMediaUrl('${id}')">
        <span style="font-size:24px">+</span>
        Adicionar mídia
      </button>
      </div>`
    : `<div class="empty-state" style="padding:24px">
        <div class="empty-state-icon">📎</div>
        <h3>Nenhuma mídia</h3>
        <button class="btn btn-sm" onclick="addMediaUrl('${id}')" style="margin-top:8px">+ Adicionar URL de mídia</button>
      </div>`;

  // Monta o modal
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'detail-modal';
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${escapeHtml(post.titulo || 'Sem título')}</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-meta">
        <span class="badge badge-tipo">${tipoEmoji} ${post.tipo || 'post'}</span>
        <span class="badge badge-status ${post.status}">${statusCfg.emoji} ${statusCfg.label}</span>
        ${post.badge ? `<span class="badge badge-custom">${post.badge}</span>` : ''}
        <span style="color:var(--text-muted);font-size:13px;margin-left:auto;">📅 ${formatDate(post.data_publicacao)}</span>
      </div>
      <div class="modal-body">
        <div class="detail-tabs">
          <button class="detail-tab active" onclick="switchDetailTab('narrativa', this)">📝 Narrativa</button>
          <button class="detail-tab" onclick="switchDetailTab('prompt-img', this)">🖼️ Prompt Imagem</button>
          <button class="detail-tab" onclick="switchDetailTab('prompt-vid', this)">🎬 Prompt Vídeo</button>
          <button class="detail-tab" onclick="switchDetailTab('legenda', this)">📱 Legenda</button>
          <button class="detail-tab" onclick="switchDetailTab('midia', this)">📎 Mídia</button>
        </div>
        <div class="detail-content active" id="detail-narrativa">${narrativaHtml}</div>
        <div class="detail-content" id="detail-prompt-img">${promptImgHtml}</div>
        <div class="detail-content" id="detail-prompt-vid">${promptVidHtml}</div>
        <div class="detail-content" id="detail-legenda">${legendaHtml}</div>
        <div class="detail-content" id="detail-midia">${midiaHtml}</div>
      </div>
      <div class="detail-actions">
        <button class="btn" onclick="openEditModal('${id}')">✏️ Editar</button>
        <div class="status-select">
          <button class="btn" onclick="toggleStatusDropdown(this)">▶️ Mudar Status</button>
          <div class="status-dropdown" id="status-dropdown">
            ${Object.entries(STATUS_CONFIG).map(([s, cfg]) => 
              `<button class="status-option" onclick="changeStatus('${id}', '${s}')">${cfg.emoji} ${cfg.label}</button>`
            ).join('')}
          </div>
        </div>
        <button class="btn" onclick="gerarLink('${id}')">🔗 Link Aprovação</button>
        <button class="btn btn-danger btn-sm" onclick="confirmarExclusao('${id}')" style="margin-left:auto">🗑️ Excluir</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
}

function switchDetailTab(tabId, btn) {
  document.querySelectorAll('.detail-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.detail-content').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`detail-${tabId}`).classList.add('active');
}

function toggleStatusDropdown(btn) {
  const dropdown = btn.nextElementSibling;
  dropdown.classList.toggle('open');
  
  // Fecha ao clicar fora
  const close = (e) => {
    if (!dropdown.contains(e.target) && e.target !== btn) {
      dropdown.classList.remove('open');
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}

async function changeStatus(id, status) {
  const result = await atualizarConteudo(id, { status });
  if (result) {
    showToast(`Status alterado para ${STATUS_CONFIG[status].label}`, 'success');
    closeModal();
    // Re-renderiza a tela
    if (state.empresaAtual && state.mesAtual) {
      renderPostsMes({ slug: state.empresaAtual.slug, mes: state.mesAtual });
    }
  }
}

async function confirmarExclusao(id) {
  if (confirm('Tem certeza que deseja excluir este conteúdo?')) {
    const ok = await deletarConteudo(id);
    if (ok) {
      closeModal();
      if (state.empresaAtual && state.mesAtual) {
        renderPostsMes({ slug: state.empresaAtual.slug, mes: state.mesAtual });
      }
    }
  }
}

async function addMediaUrl(id) {
  const url = prompt('Cole a URL da imagem/vídeo:');
  if (!url) return;
  
  const post = await getConteudoById(id);
  if (!post) return;
  
  const midiaUrls = post.midia_urls || [];
  midiaUrls.push(url);
  
  const result = await atualizarConteudo(id, { midia_urls: midiaUrls });
  if (result) {
    showToast('Mídia adicionada!', 'success');
    closeModal();
    openPostDetail(id);
  }
}

async function gerarLink(conteudoId) {
  if (!state.empresaAtual) return;
  
  const result = await criarLinkAprovacao(conteudoId, state.empresaAtual.id);
  if (!result) return;
  
  const baseUrl = getBaseUrl();
  const link = `${baseUrl}/aprovacao.html?token=${result.token}`;
  
  // Mostra o link num prompt bonito
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = 'link-modal';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <h2>🔗 Link de Aprovação</h2>
        <button class="modal-close" onclick="document.getElementById('link-modal').remove()">✕</button>
      </div>
      <div class="modal-body" style="padding-top:16px">
        <p style="color:var(--text-secondary);margin-bottom:12px;">Envie este link para o cliente aprovar o conteúdo:</p>
        <div class="link-result">
          <input type="text" class="form-control" value="${link}" readonly id="link-input">
          <button class="btn btn-primary btn-sm" onclick="copyToClipboard(document.getElementById('link-input').value)">📋 Copiar</button>
        </div>
        <p style="color:var(--text-muted);font-size:12px;margin-top:12px;">⏳ Este link expira em 30 dias.</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
}

function closeModal() {
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(m => {
    m.classList.remove('active');
    setTimeout(() => m.remove(), 200);
  });
}

// ============================================
// TELA 5: MODAL NOVO CONTEÚDO
// ============================================

function openNovoConteudo() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'novo-modal';
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

  const hoje = new Date().toISOString().split('T')[0];

  overlay.innerHTML = `
    <div class="modal" style="max-width:600px">
      <div class="modal-header">
        <h2>➕ Novo Conteúdo</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" style="padding-top:16px">
        <form id="form-novo-conteudo" onsubmit="salvarNovoConteudo(event)">
          <div class="form-group">
            <label>Título *</label>
            <input type="text" class="form-control" name="titulo" required placeholder="Ex: Carrossel sobre produtividade">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Tipo</label>
              <select class="form-control" name="tipo">
                ${TIPOS.map(t => `<option value="${t}">${TIPO_EMOJI[t] || '📄'} ${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Badge (opcional)</label>
              <input type="text" class="form-control" name="badge" placeholder="Ex: VIRAL, TREND">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Data de Publicação</label>
              <input type="date" class="form-control" name="data_publicacao" value="${hoje}">
            </div>
            <div class="form-group">
              <label>Status Inicial</label>
              <select class="form-control" name="status">
                <option value="ideia">💡 Ideia</option>
                <option value="planejado" selected>📋 Planejado</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Descrição / Narrativa</label>
            <textarea class="form-control" name="descricao" placeholder="Descreva o conteúdo, narrativa, conceito..." rows="4"></textarea>
          </div>
          <div class="form-group">
            <label>Legenda (para publicação)</label>
            <textarea class="form-control" name="legenda" placeholder="Legenda que vai na publicação..." rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Slides (um por linha)</label>
            <textarea class="form-control" name="slides" placeholder="Slide 1: texto do primeiro slide&#10;Slide 2: texto do segundo slide&#10;..." rows="4"></textarea>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
            <button type="button" class="btn" onclick="closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">💾 Salvar Conteúdo</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
  overlay.querySelector('input[name="titulo"]').focus();
}

async function salvarNovoConteudo(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  if (!state.empresaAtual) return;

  // Processa slides
  const slidesText = formData.get('slides') || '';
  const slides = slidesText.split('\n').filter(s => s.trim()).map(s => s.trim());

  const conteudo = {
    empresa_id: state.empresaAtual.id,
    titulo: formData.get('titulo'),
    tipo: formData.get('tipo'),
    badge: formData.get('badge') || null,
    data_publicacao: formData.get('data_publicacao') || null,
    status: formData.get('status'),
    descricao: formData.get('descricao') || null,
    legenda: formData.get('legenda') || null,
    slides: slides.length > 0 ? slides : [],
    mes: state.mesAtual,
    ano: state.anoAtual,
    ordem: state.conteudos.length + 1
  };

  const result = await criarConteudo(conteudo);
  if (result) {
    closeModal();
    renderPostsMes({ slug: state.empresaAtual.slug, mes: state.mesAtual });
  }
}

// ============================================
// MODAL EDITAR CONTEÚDO
// ============================================

async function openEditModal(id) {
  const post = await getConteudoById(id);
  if (!post) return;

  // Fecha modal de detalhe
  closeModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'edit-modal';
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

  const slidesText = (post.slides || []).map(s => typeof s === 'string' ? s : JSON.stringify(s)).join('\n');
  const promptsImgText = (post.prompts_imagem || []).map(p => typeof p === 'string' ? p : JSON.stringify(p)).join('\n---\n');
  const promptsVidText = (post.prompts_video || []).map(p => typeof p === 'string' ? p : JSON.stringify(p)).join('\n---\n');
  const midiaText = (post.midia_urls || []).join('\n');

  overlay.innerHTML = `
    <div class="modal" style="max-width:700px">
      <div class="modal-header">
        <h2>✏️ Editar Conteúdo</h2>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body" style="padding-top:16px">
        <form id="form-editar" onsubmit="salvarEdicao(event, '${id}')">
          <div class="form-group">
            <label>Título *</label>
            <input type="text" class="form-control" name="titulo" required value="${escapeAttr(post.titulo || '')}">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Tipo</label>
              <select class="form-control" name="tipo">
                ${TIPOS.map(t => `<option value="${t}" ${post.tipo === t ? 'selected' : ''}>${TIPO_EMOJI[t] || '📄'} ${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Badge</label>
              <input type="text" class="form-control" name="badge" value="${escapeAttr(post.badge || '')}">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Data de Publicação</label>
              <input type="date" class="form-control" name="data_publicacao" value="${post.data_publicacao || ''}">
            </div>
            <div class="form-group">
              <label>Status</label>
              <select class="form-control" name="status">
                ${Object.entries(STATUS_CONFIG).map(([s, cfg]) => 
                  `<option value="${s}" ${post.status === s ? 'selected' : ''}>${cfg.emoji} ${cfg.label}</option>`
                ).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Descrição / Narrativa</label>
            <textarea class="form-control" name="descricao" rows="5">${escapeHtml(post.descricao || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Legenda</label>
            <textarea class="form-control" name="legenda" rows="4">${escapeHtml(post.legenda || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Slides (um por linha)</label>
            <textarea class="form-control" name="slides" rows="5">${escapeHtml(slidesText)}</textarea>
          </div>
          <div class="form-group">
            <label>Prompts de Imagem (separados por ---)</label>
            <textarea class="form-control" name="prompts_imagem" rows="4">${escapeHtml(promptsImgText)}</textarea>
          </div>
          <div class="form-group">
            <label>Prompts de Vídeo (separados por ---)</label>
            <textarea class="form-control" name="prompts_video" rows="4">${escapeHtml(promptsVidText)}</textarea>
          </div>
          <div class="form-group">
            <label>URLs de Mídia (uma por linha)</label>
            <textarea class="form-control" name="midia_urls" rows="3">${escapeHtml(midiaText)}</textarea>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
            <button type="button" class="btn" onclick="closeModal()">Cancelar</button>
            <button type="submit" class="btn btn-primary">💾 Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('active'));
}

async function salvarEdicao(event, id) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);

  const slidesText = formData.get('slides') || '';
  const slides = slidesText.split('\n').filter(s => s.trim()).map(s => s.trim());

  const promptsImgText = formData.get('prompts_imagem') || '';
  const promptsImagem = promptsImgText.split('---').map(s => s.trim()).filter(s => s);

  const promptsVidText = formData.get('prompts_video') || '';
  const promptsVideo = promptsVidText.split('---').map(s => s.trim()).filter(s => s);

  const midiaText = formData.get('midia_urls') || '';
  const midiaUrls = midiaText.split('\n').map(s => s.trim()).filter(s => s);

  const updates = {
    titulo: formData.get('titulo'),
    tipo: formData.get('tipo'),
    badge: formData.get('badge') || null,
    data_publicacao: formData.get('data_publicacao') || null,
    status: formData.get('status'),
    descricao: formData.get('descricao') || null,
    legenda: formData.get('legenda') || null,
    slides,
    prompts_imagem: promptsImagem,
    prompts_video: promptsVideo,
    midia_urls: midiaUrls
  };

  const result = await atualizarConteudo(id, updates);
  if (result) {
    showToast('Conteúdo atualizado!', 'success');
    closeModal();
    if (state.empresaAtual && state.mesAtual) {
      renderPostsMes({ slug: state.empresaAtual.slug, mes: state.mesAtual });
    }
  }
}

// ============================================
// UTILITÁRIOS HTML
// ============================================

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
