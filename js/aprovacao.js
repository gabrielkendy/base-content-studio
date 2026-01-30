// ============================================
// BASE Content Studio - Página de Aprovação
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  carregarAprovacao();
});

async function carregarAprovacao() {
  const container = document.getElementById('aprovacao-app');
  
  // Pega token da URL
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (!token) {
    container.innerHTML = renderErro('Link inválido', 'Este link de aprovação não é válido. Verifique com a agência.');
    return;
  }

  // Loading
  container.innerHTML = `
    <div class="aprovacao-container">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `;

  // Busca dados
  const aprovacao = await getAprovacaoByToken(token);

  if (!aprovacao) {
    container.innerHTML = renderErro('Link não encontrado', 'Este link de aprovação não existe ou já expirou.');
    return;
  }

  // Verifica se já foi respondido
  if (aprovacao.status !== 'pendente') {
    container.innerHTML = renderJaRespondido(aprovacao);
    return;
  }

  // Verifica expiração
  if (aprovacao.expires_at && new Date(aprovacao.expires_at) < new Date()) {
    container.innerHTML = renderErro('Link expirado', 'Este link de aprovação expirou. Solicite um novo link à agência.');
    return;
  }

  const conteudo = aprovacao.planejamento_conteudos;
  const empresa = aprovacao.empresas;

  if (!conteudo) {
    container.innerHTML = renderErro('Conteúdo não encontrado', 'O conteúdo associado a este link não foi encontrado.');
    return;
  }

  const cores = empresa?.cores || {};
  const primaria = cores.primaria || '#6366F1';
  const secundaria = cores.secundaria || '#818CF8';

  // Aplica cores da marca
  document.documentElement.style.setProperty('--accent', primaria);
  document.documentElement.style.setProperty('--accent-secondary', secundaria);

  const tipoEmoji = TIPO_EMOJI[conteudo.tipo] || '📄';
  const slides = conteudo.slides || [];
  const midiaUrls = conteudo.midia_urls || [];

  container.innerHTML = `
    <div class="aprovacao-container">
      <div class="aprovacao-header">
        <div style="width:60px;height:60px;border-radius:16px;background:${primaria};display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px;color:white;font-weight:800;">
          ${empresa ? empresa.nome.charAt(0) : 'B'}
        </div>
        <h1 style="color:${primaria}">${empresa ? empresa.nome : 'BASE'}</h1>
        <p>Aprovação de conteúdo</p>
      </div>

      <div class="aprovacao-card">
        <div class="aprovacao-card-header" style="border-left:4px solid ${primaria}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span class="badge badge-tipo">${tipoEmoji} ${conteudo.tipo || 'post'}</span>
            ${conteudo.badge ? `<span class="badge badge-custom">${conteudo.badge}</span>` : ''}
            ${conteudo.data_publicacao ? `<span style="color:var(--text-muted);font-size:13px;margin-left:auto;">📅 ${formatDate(conteudo.data_publicacao)}</span>` : ''}
          </div>
          <h2 style="font-size:22px;font-weight:700;">${escapeHtmlAprov(conteudo.titulo || 'Sem título')}</h2>
        </div>
        <div class="aprovacao-card-body">
          ${conteudo.descricao ? `
            <div class="aprovacao-section">
              <h3>📝 Narrativa</h3>
              <div class="aprovacao-text">${escapeHtmlAprov(conteudo.descricao)}</div>
            </div>
          ` : ''}

          ${slides.length > 0 ? `
            <div class="aprovacao-section">
              <h3>📑 Slides</h3>
              <div class="slides-list">
                ${slides.map(s => {
                  const text = typeof s === 'string' ? s : (s.texto || s.content || JSON.stringify(s));
                  return `<div class="slide-item"><p>${escapeHtmlAprov(text)}</p></div>`;
                }).join('')}
              </div>
            </div>
          ` : ''}

          ${conteudo.legenda ? `
            <div class="aprovacao-section">
              <h3>📱 Legenda</h3>
              <div class="aprovacao-text" style="background:var(--bg-tertiary);padding:16px;border-radius:8px;">${escapeHtmlAprov(conteudo.legenda)}</div>
            </div>
          ` : ''}

          ${midiaUrls.length > 0 ? `
            <div class="aprovacao-section">
              <h3>📎 Mídia</h3>
              <div class="media-grid">
                ${midiaUrls.map(url => `
                  <div class="media-item">
                    <img src="${url}" alt="Mídia" onerror="this.style.display='none'">
                    <div class="media-item-overlay">
                      <a href="${url}" target="_blank" download class="btn btn-sm" style="background:white;color:black;">⬇ Download</a>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <div id="aprovacao-area">
        <div class="form-group" style="max-width:300px;margin:0 auto 20px;">
          <label>Seu nome (opcional)</label>
          <input type="text" class="form-control" id="cliente-nome" placeholder="Seu nome">
        </div>
        <div class="aprovacao-actions">
          <button class="aprovacao-btn aprovacao-btn-aprovar" onclick="aprovar('${token}')">
            ✅ APROVAR
          </button>
          <button class="aprovacao-btn aprovacao-btn-ajuste" onclick="pedirAjuste('${token}')">
            ❌ PEDIR AJUSTE
          </button>
        </div>
        <div class="comment-box" id="comment-box">
          <div class="form-group">
            <label>O que precisa ser ajustado?</label>
            <textarea class="form-control" id="comentario-ajuste" placeholder="Descreva os ajustes necessários..." rows="4"></textarea>
          </div>
          <div style="text-align:center;margin-top:12px;">
            <button class="btn btn-danger" onclick="enviarAjuste('${token}')">📤 Enviar Ajuste</button>
            <button class="btn" onclick="document.getElementById('comment-box').classList.remove('active')" style="margin-left:8px;">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function aprovar(token) {
  const nome = document.getElementById('cliente-nome').value || '';
  const btn = document.querySelector('.aprovacao-btn-aprovar');
  btn.disabled = true;
  btn.textContent = '⏳ Enviando...';

  const result = await responderAprovacao(token, 'aprovado', '', nome);
  
  if (result) {
    document.getElementById('aprovacao-area').innerHTML = `
      <div class="feedback-box success">
        <div class="feedback-icon">🎉</div>
        <h2 style="color:var(--success);margin-bottom:8px;">Aprovado!</h2>
        <p style="color:var(--text-secondary);">O conteúdo foi aprovado com sucesso. A equipe será notificada.</p>
      </div>
    `;
  } else {
    btn.disabled = false;
    btn.textContent = '✅ APROVAR';
    showToast('Erro ao enviar aprovação. Tente novamente.', 'error');
  }
}

function pedirAjuste(token) {
  document.getElementById('comment-box').classList.add('active');
  document.getElementById('comentario-ajuste').focus();
}

async function enviarAjuste(token) {
  const nome = document.getElementById('cliente-nome').value || '';
  const comentario = document.getElementById('comentario-ajuste').value;
  
  if (!comentario.trim()) {
    showToast('Por favor, descreva os ajustes necessários.', 'error');
    return;
  }

  const result = await responderAprovacao(token, 'ajuste', comentario, nome);
  
  if (result) {
    document.getElementById('aprovacao-area').innerHTML = `
      <div class="feedback-box ajuste">
        <div class="feedback-icon">📝</div>
        <h2 style="color:var(--danger);margin-bottom:8px;">Ajuste Solicitado</h2>
        <p style="color:var(--text-secondary);">Seus comentários foram enviados. A equipe entrará em contato.</p>
      </div>
    `;
  } else {
    showToast('Erro ao enviar ajuste. Tente novamente.', 'error');
  }
}

function renderErro(titulo, mensagem) {
  return `
    <div class="aprovacao-container">
      <div class="aprovacao-header">
        <div class="feedback-box">
          <div class="feedback-icon">⚠️</div>
          <h2 style="margin-bottom:8px;">${titulo}</h2>
          <p style="color:var(--text-secondary);">${mensagem}</p>
        </div>
      </div>
    </div>
  `;
}

function renderJaRespondido(aprovacao) {
  const isAprovado = aprovacao.status === 'aprovado';
  return `
    <div class="aprovacao-container">
      <div class="aprovacao-header">
        <div class="feedback-box ${isAprovado ? 'success' : 'ajuste'}">
          <div class="feedback-icon">${isAprovado ? '✅' : '📝'}</div>
          <h2 style="color:${isAprovado ? 'var(--success)' : 'var(--danger)'};margin-bottom:8px;">
            ${isAprovado ? 'Já Aprovado' : 'Ajuste Já Solicitado'}
          </h2>
          <p style="color:var(--text-secondary);">
            Este conteúdo já foi ${isAprovado ? 'aprovado' : 'marcado para ajuste'}.
            ${aprovacao.comentario_cliente ? `<br><br><strong>Comentário:</strong> ${escapeHtmlAprov(aprovacao.comentario_cliente)}` : ''}
          </p>
        </div>
      </div>
    </div>
  `;
}

function escapeHtmlAprov(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
