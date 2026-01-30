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
  tabAtiva: 'planejamento',
  abAtivaVisaoAnual: 'anual',  // 'anual' ou 'workflow'
  kanbanData: {},
  filtroMes: 'todos',
  filtroStatus: 'todos'
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
    
    <div class="month-tabs" style="margin-bottom:24px;">
      <button class="month-tab ${state.abAtivaVisaoAnual === 'anual' ? 'active' : ''}" data-view="anual" onclick="switchVisaoAnualTab('anual')">📅 Visão Anual</button>
      <button class="month-tab ${state.abAtivaVisaoAnual === 'workflow' ? 'active' : ''}" data-view="workflow" onclick="switchVisaoAnualTab('workflow')">📋 Workflow</button>
    </div>

    <div id="tab-visao-anual" class="tab-content" ${state.abAtivaVisaoAnual === 'anual' ? '' : 'style="display:none;"'}>
      <div class="months-grid" id="months-grid"></div>
    </div>
    
    <div id="tab-workflow" class="tab-content" ${state.abAtivaVisaoAnual === 'workflow' ? '' : 'style="display:none;"'}>
      <div id="workflow-container"></div>
    </div>
  `;

  // Popular visão anual (grid de meses)
  const grid = document.getElementById('months-grid');
  if (grid) {
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
  
  // Inicializar workflow se necessário
  if (state.abAtivaVisaoAnual === 'workflow') {
    await renderWorkflow();
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

  const midiaItemsHtml = midiaUrls.map((url, i) => {
    const isVideo = /\.(mp4|mov|webm|avi)/i.test(url) || url.includes('video');
    return `<div class="media-item">
      ${isVideo 
        ? `<video src="${url}" style="width:100%;height:100%;object-fit:cover;" muted></video>`
        : `<img src="${url}" alt="Mídia" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%2250%25%22 x=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 font-size=%2230%22>📎</text></svg>'">`
      }
      <div class="media-item-overlay">
        <a href="${url}" target="_blank" class="btn btn-sm" style="background:white;color:black;">⬇ Abrir</a>
        <button class="btn btn-sm" onclick="removeMedia('${id}', ${i})" style="background:#EF4444;color:white;margin-top:4px;">🗑️</button>
      </div>
    </div>`;
  }).join('');

  const midiaHtml = `
    <div class="media-upload-area" id="media-upload-area"
      ondragover="event.preventDefault(); this.classList.add('dragover')"
      ondragleave="this.classList.remove('dragover')"
      ondrop="handleMediaDrop(event, '${id}')">
      ${midiaUrls.length > 0 ? `<div class="media-grid">${midiaItemsHtml}</div>` : ''}
      <div class="media-upload-zone" onclick="document.getElementById('media-file-input').click()">
        <input type="file" id="media-file-input" hidden multiple accept="image/*,video/*"
          onchange="handleMediaUpload(this.files, '${id}')">
        <div style="text-align:center;padding:20px;">
          <div style="font-size:32px;margin-bottom:8px;">📎</div>
          <strong>Clique ou arraste arquivos aqui</strong>
          <p style="color:var(--text-muted);font-size:13px;margin-top:4px;">Imagens e vídeos • JPG, PNG, MP4, MOV</p>
        </div>
      </div>
      <div id="media-upload-progress" style="display:none;padding:12px;">
        <div style="background:var(--surface-2);border-radius:8px;overflow:hidden;height:6px;">
          <div id="media-progress-bar" style="background:var(--accent);height:100%;width:0%;transition:width 0.3s;"></div>
        </div>
        <p id="media-progress-text" style="color:var(--text-muted);font-size:12px;margin-top:4px;text-align:center;">Enviando...</p>
      </div>
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

async function handleMediaUpload(files, conteudoId) {
  if (!files || !files.length) return;
  
  const progressDiv = document.getElementById('media-upload-progress');
  const progressBar = document.getElementById('media-progress-bar');
  const progressText = document.getElementById('media-progress-text');
  if (progressDiv) progressDiv.style.display = 'block';

  const slug = state.empresaAtual?.slug || 'geral';
  const total = files.length;
  let uploaded = 0;

  for (const file of files) {
    if (progressText) progressText.textContent = `Enviando ${uploaded + 1}/${total}: ${file.name}...`;
    if (progressBar) progressBar.style.width = `${(uploaded / total) * 100}%`;

    try {
      const url = await uploadMedia(file, slug, conteudoId);
      if (url) {
        await addMediaToPost(conteudoId, url);
        uploaded++;
      }
    } catch (err) {
      console.error('Erro upload:', err);
      showToast(`Erro ao enviar ${file.name}`, 'error');
    }
  }

  if (progressBar) progressBar.style.width = '100%';
  if (progressText) progressText.textContent = `✅ ${uploaded} arquivo(s) enviado(s)!`;
  
  showToast(`${uploaded} mídia(s) adicionada(s)!`, 'success');
  
  setTimeout(() => {
    closeModal();
    openPostDetail(conteudoId);
  }, 500);
}

function handleMediaDrop(event, conteudoId) {
  event.preventDefault();
  const area = document.getElementById('media-upload-area');
  if (area) area.classList.remove('dragover');
  
  if (event.dataTransfer.files.length) {
    handleMediaUpload(event.dataTransfer.files, conteudoId);
  }
}

async function removeMedia(conteudoId, index) {
  if (!confirm('Remover esta mídia?')) return;
  const result = await removeMediaFromPost(conteudoId, index);
  if (result) {
    showToast('Mídia removida', 'success');
    closeModal();
    openPostDetail(conteudoId);
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

// ============================================
// VISÃO ANUAL - CONTROLE DE ABAS
// ============================================

function switchVisaoAnualTab(tab) {
  state.abAtivaVisaoAnual = tab;
  
  // Atualiza botões - usa data-view pra distinguir das tabs de mês
  document.querySelectorAll('.month-tab[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === tab);
  });
  
  // Atualiza conteúdo
  document.getElementById('tab-visao-anual').style.display = tab === 'anual' ? 'block' : 'none';
  document.getElementById('tab-workflow').style.display = tab === 'workflow' ? 'block' : 'none';
  
  // Carrega workflow se necessário
  if (tab === 'workflow') {
    renderWorkflow();
  }
}

// ============================================
// WORKFLOW KANBAN
// ============================================

async function renderWorkflow() {
  const container = document.getElementById('workflow-container');
  if (!container || !state.empresaAtual) return;
  
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  
  // Buscar dados do kanban
  state.kanbanData = await getConteudosByStatus(state.empresaAtual.id);
  
  container.innerHTML = `
    <div class="workflow-filters">
      <select id="filtro-mes" onchange="aplicarFiltros()">
        <option value="todos">Todos os meses</option>
        ${MESES.map((mes, i) => `<option value="${i+1}" ${state.filtroMes == (i+1) ? 'selected' : ''}>${mes}</option>`).join('')}
      </select>
      <select id="filtro-status" onchange="aplicarFiltros()">
        <option value="todos">Todos os status</option>
        ${KANBAN_CONFIG.map(cfg => `<option value="${cfg.key}" ${state.filtroStatus === cfg.key ? 'selected' : ''}>${cfg.emoji} ${cfg.label}</option>`).join('')}
      </select>
      <button class="btn btn-primary" onclick="openAddDemandModal()">+ Adicionar demanda</button>
    </div>
    
    <div class="kanban-board" id="kanban-board">
      ${KANBAN_CONFIG.map(cfg => renderKanbanColumn(cfg)).join('')}
    </div>
  `;
  
  // Inicializar drag and drop
  initializeDragAndDrop();
}

function renderKanbanColumn(columnConfig) {
  const { key, emoji, label, color } = columnConfig;
  const items = state.kanbanData[key] || [];
  
  // Aplicar filtros
  const filteredItems = items.filter(item => {
    if (state.filtroMes !== 'todos' && item.mes != state.filtroMes) return false;
    if (state.filtroStatus !== 'todos' && item.status !== state.filtroStatus) return false;
    return true;
  });
  
  return `
    <div class="kanban-column" data-status="${key}">
      <div class="kanban-column-header">
        <div class="kanban-column-title" style="color:${color}">
          <span>${emoji}</span>
          <span>${label}</span>
        </div>
        <div class="kanban-column-count">${filteredItems.length} item${filteredItems.length === 1 ? '' : 's'}</div>
      </div>
      <div class="kanban-column-body">
        <div class="kanban-drop-zone" data-status="${key}">
          ${filteredItems.map(item => renderKanbanCard(item)).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderKanbanCard(item) {
  const tipoEmoji = TIPO_EMOJI[item.tipo] || '📄';
  const inicial = state.empresaAtual.nome.charAt(0).toUpperCase();
  const cores = state.empresaAtual.cores || {};
  const primaria = cores.primaria || '#6366F1';
  
  // Primeira imagem se houver
  const primeiraImagem = (item.midia_urls && item.midia_urls.length > 0) ? item.midia_urls[0] : null;
  
  return `
    <div class="kanban-card" 
         draggable="true" 
         data-id="${item.id}" 
         data-status="${item.status}"
         oncontextmenu="showCardContextMenu(event, '${item.id}')">
      
      <div class="kanban-card-header">
        <div style="flex:1;">
          <div class="kanban-card-title">${escapeHtml(item.titulo || 'Sem título')}</div>
          
          <div class="kanban-card-meta">
            <span class="kanban-card-badge" style="background:${primaria}">${inicial}</span>
            <span class="kanban-card-tipo" title="${item.tipo || 'post'}">${tipoEmoji}</span>
            ${item.data_publicacao ? `<span class="kanban-card-date">${formatDate(item.data_publicacao)}</span>` : ''}
          </div>
        </div>
        
        <div class="kanban-card-actions">
          <button class="kanban-card-action" onclick="openPostDetail('${item.id}')" title="Ver detalhes">👁️</button>
          <button class="kanban-card-action delete" onclick="confirmarExclusao('${item.id}')" title="Excluir">🗑️</button>
        </div>
      </div>
      
      ${primeiraImagem ? `
        <div class="kanban-card-preview">
          <img src="${primeiraImagem}" alt="Preview" onerror="this.parentElement.style.display='none'">
        </div>
      ` : ''}
    </div>
  `;
}

function aplicarFiltros() {
  state.filtroMes = document.getElementById('filtro-mes').value;
  state.filtroStatus = document.getElementById('filtro-status').value;
  renderWorkflow();
}

// ============================================
// DRAG AND DROP
// ============================================

function initializeDragAndDrop() {
  const cards = document.querySelectorAll('.kanban-card');
  const dropZones = document.querySelectorAll('.kanban-drop-zone');
  
  // Event listeners para cards
  cards.forEach(card => {
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
  });
  
  // Event listeners para drop zones
  dropZones.forEach(zone => {
    zone.addEventListener('dragover', handleDragOver);
    zone.addEventListener('dragenter', handleDragEnter);
    zone.addEventListener('dragleave', handleDragLeave);
    zone.addEventListener('drop', handleDrop);
  });
}

let draggedElement = null;
let placeholder = null;

function handleDragStart(e) {
  draggedElement = this;
  this.classList.add('dragging');
  
  // Criar placeholder
  placeholder = document.createElement('div');
  placeholder.className = 'kanban-placeholder';
  placeholder.innerHTML = 'Solte aqui';
  
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  
  // Remover placeholder
  if (placeholder && placeholder.parentNode) {
    placeholder.parentNode.removeChild(placeholder);
  }
  
  draggedElement = null;
  placeholder = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  if (!draggedElement) return;
  
  const afterElement = getDragAfterElement(this, e.clientY);
  
  if (afterElement == null) {
    this.appendChild(placeholder);
  } else {
    this.insertBefore(placeholder, afterElement);
  }
  
  placeholder.classList.add('visible');
}

function handleDragEnter(e) {
  e.preventDefault();
  this.classList.add('drag-over');
}

function handleDragLeave(e) {
  // Só remove se realmente saiu da zona
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('drag-over');
    if (placeholder && placeholder.parentNode === this) {
      placeholder.classList.remove('visible');
    }
  }
}

async function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  
  if (!draggedElement) return;
  
  const newStatus = this.dataset.status;
  const cardId = draggedElement.dataset.id;
  const oldStatus = draggedElement.dataset.status;
  
  if (newStatus !== oldStatus) {
    // Atualizar no banco
    const result = await updateConteudoStatus(cardId, newStatus);
    if (result) {
      // Atualizar estado local
      const item = findItemInKanbanData(cardId);
      if (item) {
        // Remove do status antigo
        state.kanbanData[oldStatus] = state.kanbanData[oldStatus].filter(i => i.id !== cardId);
        // Adiciona no novo status
        item.status = newStatus;
        if (!state.kanbanData[newStatus]) state.kanbanData[newStatus] = [];
        state.kanbanData[newStatus].push(item);
        
        // Re-renderizar
        renderWorkflow();
      }
    }
  }
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function findItemInKanbanData(id) {
  for (const status in state.kanbanData) {
    const item = state.kanbanData[status].find(i => i.id === id);
    if (item) return item;
  }
  return null;
}

// ============================================
// MODAL ADICIONAR DEMANDA
// ============================================

// ============================================
// CANAIS DE PUBLICAÇÃO
// ============================================
const CANAIS = [
  { id: 'instagram', icon: '📷', label: 'Instagram', color: '#E4405F' },
  { id: 'tiktok', icon: '🎵', label: 'TikTok', color: '#000000' },
  { id: 'facebook', icon: '👤', label: 'Facebook', color: '#1877F2' },
  { id: 'youtube', icon: '▶️', label: 'YouTube', color: '#FF0000' },
  { id: 'twitter', icon: '𝕏', label: 'X / Twitter', color: '#1DA1F2' },
  { id: 'linkedin', icon: '💼', label: 'LinkedIn', color: '#0A66C2' },
  { id: 'pinterest', icon: '📌', label: 'Pinterest', color: '#E60023' },
  { id: 'whatsapp', icon: '💬', label: 'WhatsApp', color: '#25D366' },
  { id: 'telegram', icon: '✈️', label: 'Telegram', color: '#0088CC' },
  { id: 'threads', icon: '🧵', label: 'Threads', color: '#000000' },
  { id: 'stories', icon: '⏳', label: 'Stories', color: '#FF6B35' },
  { id: 'blog', icon: '📝', label: 'Blog', color: '#7C3AED' },
];

function openAddDemandModal() {
  if (!state.empresaAtual) return;

  const hoje = new Date().toISOString().split('T')[0];
  const cores = state.empresaAtual.cores || {};
  const primaria = cores.primaria || '#6366F1';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay demand-fullpage-modal';
  overlay.id = 'add-demand-modal';

  overlay.innerHTML = `
    <div class="demand-page">
      <div class="demand-page-header">
        <div class="demand-page-title">
          <span class="demand-icon" style="background:${primaria}">📋</span>
          <div>
            <h2>Nova Demanda</h2>
            <p class="demand-subtitle">Preencha os campos para criar uma demanda — <strong>${escapeHtml(state.empresaAtual.nome)}</strong></p>
          </div>
        </div>
        <button class="demand-close" onclick="closeModal()">✕</button>
      </div>

      <form id="form-add-demand" class="demand-form" onsubmit="salvarDemandaCompleta(event)">
        
        <!-- 1. Título -->
        <div class="demand-field">
          <div class="demand-field-number">1</div>
          <div class="demand-field-content">
            <label class="demand-label">Título da demanda</label>
            <input type="text" class="demand-input" name="titulo" required 
              placeholder="Ex: Carrossel sobre benefícios do treino funcional">
          </div>
        </div>

        <!-- 2. Tipo de conteúdo -->
        <div class="demand-field">
          <div class="demand-field-number">2</div>
          <div class="demand-field-content">
            <label class="demand-label">Tipo de conteúdo</label>
            <div class="demand-tipo-grid">
              ${TIPOS.map(t => `
                <button type="button" class="demand-tipo-btn" data-tipo="${t}" onclick="selectDemandTipo(this, '${t}')">
                  <span class="demand-tipo-icon">${TIPO_EMOJI[t] || '📄'}</span>
                  <span class="demand-tipo-name">${t}</span>
                </button>
              `).join('')}
            </div>
            <input type="hidden" name="tipo" value="carrossel">
          </div>
        </div>

        <!-- 3. Canais de publicação -->
        <div class="demand-field">
          <div class="demand-field-number">3</div>
          <div class="demand-field-content">
            <label class="demand-label">Em quais canais será publicado?</label>
            <div class="demand-canais-grid">
              ${CANAIS.map(c => `
                <button type="button" class="demand-canal-btn" data-canal="${c.id}" 
                  onclick="toggleDemandCanal(this)" title="${c.label}">
                  <span class="demand-canal-icon">${c.icon}</span>
                </button>
              `).join('')}
            </div>
            <input type="hidden" name="canais" value="">
          </div>
        </div>

        <!-- 4. Data prevista -->
        <div class="demand-field">
          <div class="demand-field-number">4</div>
          <div class="demand-field-content">
            <label class="demand-label">Data prevista para publicação</label>
            <div class="demand-date-row">
              <input type="date" class="demand-input demand-input-date" name="data_publicacao" value="${hoje}">
              <input type="time" class="demand-input demand-input-time" name="hora_publicacao" value="10:00">
            </div>
          </div>
        </div>

        <!-- 5. Agendamento automático -->
        <div class="demand-field">
          <div class="demand-field-number">5</div>
          <div class="demand-field-content">
            <label class="demand-label">Agendamento automático</label>
            <label class="demand-toggle">
              <input type="checkbox" name="agendamento_auto">
              <span class="demand-toggle-slider"></span>
              <span class="demand-toggle-text">Demanda será agendada automaticamente após aprovação</span>
            </label>
          </div>
        </div>

        <!-- 6. Tags -->
        <div class="demand-field">
          <div class="demand-field-number">6</div>
          <div class="demand-field-content">
            <label class="demand-label">Tags</label>
            <input type="text" class="demand-input" name="tags" 
              placeholder="Ex: fitness, treino, motivação (separe por vírgula)">
          </div>
        </div>

        <!-- 7. Briefing -->
        <div class="demand-field">
          <div class="demand-field-number">7</div>
          <div class="demand-field-content">
            <label class="demand-label">Briefing</label>
            <div class="demand-editor-toolbar">
              <button type="button" onclick="execBriefingCmd('bold')" title="Negrito"><strong>B</strong></button>
              <button type="button" onclick="execBriefingCmd('italic')" title="Itálico"><em>I</em></button>
              <button type="button" onclick="execBriefingCmd('underline')" title="Sublinhado"><u>U</u></button>
              <button type="button" onclick="execBriefingCmd('strikeThrough')" title="Tachado"><s>S</s></button>
              <span class="demand-editor-sep"></span>
              <button type="button" onclick="execBriefingCmd('insertUnorderedList')" title="Lista">☰</button>
              <button type="button" onclick="execBriefingCmd('insertOrderedList')" title="Lista numerada">1.</button>
              <span class="demand-editor-sep"></span>
              <button type="button" onclick="execBriefingCmd('createLink', prompt('URL:'))" title="Link">🔗</button>
            </div>
            <div class="demand-editor" id="briefing-editor" contenteditable="true" 
              data-placeholder="Descreva o briefing da demanda, referências, tom de voz..."></div>
          </div>
        </div>

        <!-- Upload de arquivo -->
        <div class="demand-upload-zone" id="demand-upload-zone"
          onclick="document.getElementById('demand-file-input').click()">
          <div class="demand-upload-icon">☁️</div>
          <div class="demand-upload-text">
            <strong>Selecione um arquivo ou arraste aqui.</strong>
            <span>Formatos: PNG, JPG, GIF, PDF, DOCX — até 50MB</span>
          </div>
          <button type="button" class="demand-upload-btn">Selecionar arquivo</button>
          <input type="file" id="demand-file-input" name="arquivo" hidden 
            accept=".png,.jpg,.jpeg,.gif,.pdf,.docx"
            onchange="handleDemandFileSelect(this)">
        </div>
        <div id="demand-file-preview" class="demand-file-preview" style="display:none;"></div>

        <!-- Botões -->
        <div class="demand-actions">
          <button type="button" class="demand-btn-back" onclick="closeModal()">← Voltar</button>
          <div class="demand-actions-right">
            <button type="button" class="demand-btn-draft" onclick="salvarDemandaCompleta(event, true)">
              💾 Salvar como rascunho
            </button>
            <button type="submit" class="demand-btn-submit">
              Avançar →
            </button>
          </div>
        </div>

      </form>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.classList.add('active');
    // Selecionar primeiro tipo por padrão
    const firstTipo = overlay.querySelector('.demand-tipo-btn');
    if (firstTipo) firstTipo.classList.add('selected');
  });
  overlay.querySelector('input[name="titulo"]').focus();

  // Drag and drop no upload zone
  const uploadZone = overlay.querySelector('#demand-upload-zone');
  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      document.getElementById('demand-file-input').files = e.dataTransfer.files;
      handleDemandFileSelect(document.getElementById('demand-file-input'));
    }
  });
}

// Seleção de tipo de conteúdo
function selectDemandTipo(btn, tipo) {
  document.querySelectorAll('.demand-tipo-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  document.querySelector('input[name="tipo"]').value = tipo;
}

// Toggle canal de publicação
function toggleDemandCanal(btn) {
  btn.classList.toggle('selected');
  const canaisSelecionados = Array.from(document.querySelectorAll('.demand-canal-btn.selected'))
    .map(b => b.dataset.canal);
  document.querySelector('input[name="canais"]').value = canaisSelecionados.join(',');
}

// Comandos do editor de briefing
function execBriefingCmd(cmd, value) {
  document.execCommand(cmd, false, value || null);
  document.getElementById('briefing-editor').focus();
}

// Upload de arquivo
function handleDemandFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  
  const preview = document.getElementById('demand-file-preview');
  const zone = document.getElementById('demand-upload-zone');
  
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `
        <div class="demand-file-card">
          <img src="${e.target.result}" alt="${file.name}" class="demand-file-img">
          <div class="demand-file-info">
            <strong>${file.name}</strong>
            <span>${(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <button type="button" class="demand-file-remove" onclick="removeDemandFile()">✕</button>
        </div>
      `;
      preview.style.display = 'block';
      zone.style.display = 'none';
    };
    reader.readAsDataURL(file);
  } else {
    preview.innerHTML = `
      <div class="demand-file-card">
        <div class="demand-file-icon">📄</div>
        <div class="demand-file-info">
          <strong>${file.name}</strong>
          <span>${(file.size / 1024 / 1024).toFixed(2)} MB</span>
        </div>
        <button type="button" class="demand-file-remove" onclick="removeDemandFile()">✕</button>
      </div>
    `;
    preview.style.display = 'block';
    zone.style.display = 'none';
  }
}

function removeDemandFile() {
  document.getElementById('demand-file-input').value = '';
  document.getElementById('demand-file-preview').style.display = 'none';
  document.getElementById('demand-upload-zone').style.display = 'flex';
}

// Salvar demanda completa
async function salvarDemandaCompleta(event, asDraft) {
  if (event) event.preventDefault();
  if (!state.empresaAtual) return;

  const form = document.getElementById('form-add-demand');
  const formData = new FormData(form);
  const briefingEl = document.getElementById('briefing-editor');

  const titulo = formData.get('titulo');
  if (!titulo?.trim()) {
    showToast('Preencha o título da demanda', 'error');
    return;
  }

  const dataStr = formData.get('data_publicacao');
  const dataPub = dataStr ? new Date(dataStr) : new Date();
  const mes = dataPub.getMonth() + 1;
  const ano = dataPub.getFullYear();

  const dados = {
    empresaId: state.empresaAtual.id,
    titulo: titulo.trim(),
    tipo: formData.get('tipo') || 'carrossel',
    descricao: briefingEl ? briefingEl.innerHTML : (formData.get('descricao') || ''),
    dataPublicacao: dataStr || null,
    mes: mes,
    ano: ano,
    ordem: 999
  };

  // Metadata extra (canais, tags, hora, agendamento)
  const canais = formData.get('canais');
  const tags = formData.get('tags');
  const hora = formData.get('hora_publicacao');
  const autoSchedule = formData.get('agendamento_auto');

  // Salvar metadata como badge (temporário até ter campos próprios)
  const badges = [];
  if (canais) badges.push(canais);
  if (tags) badges.push(tags);
  if (hora) badges.push(`🕐 ${hora}`);
  dados.badge = badges.join(' | ');

  // Status: rascunho se salvar como draft, senão conteudo (avançar)
  dados.status = asDraft ? 'rascunho' : 'conteudo';

  const result = await createConteudoRapido(dados);
  if (result) {
    closeModal();
    const targetStatus = asDraft ? 'rascunho' : 'conteudo';
    if (!state.kanbanData[targetStatus]) state.kanbanData[targetStatus] = [];
    state.kanbanData[targetStatus].push(result);
    renderWorkflow();
    showToast(asDraft ? 'Demanda salva como rascunho!' : 'Demanda criada e avançada para Conteúdo!', 'success');
  }
}
