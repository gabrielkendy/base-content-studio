// ============================================
// BASE Content Studio - Supabase Connection & CRUD
// ============================================

const SUPABASE_URL = 'https://gpqxqykgcrpmvwxktjvp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcXhxeWtnY3JwbXZ3eGt0anZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxNjMxNTMsImV4cCI6MjA4MjczOTE1M30.v1WbmTecfEEW7g_-NI1uYP0sxIZxquv3rZPQ83a-nKI';

// Inicializa o cliente Supabase
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// EMPRESAS
// ============================================

async function getEmpresas() {
  try {
    const { data, error } = await db.from('empresas')
      .select('*')
      .order('nome');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar empresas:', err);
    showToast('Erro ao carregar clientes', 'error');
    return [];
  }
}

async function getEmpresaBySlug(slug) {
  try {
    const { data, error } = await db.from('empresas')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao buscar empresa:', err);
    showToast('Cliente não encontrado', 'error');
    return null;
  }
}

// ============================================
// CONTEÚDOS (planejamento_conteudos)
// ============================================

async function getConteudos(empresaId, mes = null, ano = null) {
  try {
    let query = db.from('planejamento_conteudos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('ordem', { ascending: true })
      .order('data_publicacao', { ascending: true });

    if (mes !== null) query = query.eq('mes', mes);
    if (ano !== null) query = query.eq('ano', ano);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar conteúdos:', err);
    showToast('Erro ao carregar conteúdos', 'error');
    return [];
  }
}

async function getConteudoById(id) {
  try {
    const { data, error } = await db.from('planejamento_conteudos')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao buscar conteúdo:', err);
    showToast('Conteúdo não encontrado', 'error');
    return null;
  }
}

async function criarConteudo(conteudo) {
  try {
    const { data, error } = await db.from('planejamento_conteudos')
      .insert([conteudo])
      .select()
      .single();
    if (error) throw error;
    showToast('Conteúdo criado com sucesso!', 'success');
    return data;
  } catch (err) {
    console.error('Erro ao criar conteúdo:', err);
    showToast('Erro ao criar conteúdo', 'error');
    return null;
  }
}

async function atualizarConteudo(id, updates) {
  try {
    const { data, error } = await db.from('planejamento_conteudos')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar conteúdo:', err);
    showToast('Erro ao salvar alterações', 'error');
    return null;
  }
}

async function deletarConteudo(id) {
  try {
    const { error } = await db.from('planejamento_conteudos')
      .delete()
      .eq('id', id);
    if (error) throw error;
    showToast('Conteúdo excluído', 'success');
    return true;
  } catch (err) {
    console.error('Erro ao deletar conteúdo:', err);
    showToast('Erro ao excluir conteúdo', 'error');
    return false;
  }
}

// Contagem de conteúdos por empresa
async function getConteudoCount(empresaId) {
  try {
    const { count, error } = await db.from('planejamento_conteudos')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', empresaId);
    if (error) throw error;
    return count || 0;
  } catch (err) {
    return 0;
  }
}

// ============================================
// WORKFLOW KANBAN - NOVAS FUNÇÕES
// ============================================

async function getConteudosByStatus(empresaId) {
  try {
    const { data, error } = await db.from('planejamento_conteudos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('ordem', { ascending: true })
      .order('data_publicacao', { ascending: true });
    if (error) throw error;
    
    // Agrupa por status
    const porStatus = {};
    ['rascunho', 'conteudo', 'aprovacao_cliente', 'ajustes', 'aguardando', 'aprovado_agendado', 'concluido'].forEach(status => {
      porStatus[status] = [];
    });
    
    (data || []).forEach(item => {
      const status = item.status || 'rascunho';
      if (porStatus[status]) {
        porStatus[status].push(item);
      } else {
        porStatus['rascunho'].push(item);
      }
    });
    
    return porStatus;
  } catch (err) {
    console.error('Erro ao buscar conteúdos por status:', err);
    showToast('Erro ao carregar conteúdos', 'error');
    return {};
  }
}

async function updateConteudoStatus(id, status) {
  try {
    const { data, error } = await db.from('planejamento_conteudos')
      .update({ status: status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    showToast(`Status atualizado para ${status}`, 'success');
    return data;
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    showToast('Erro ao atualizar status', 'error');
    return null;
  }
}

async function createConteudoRapido(dados) {
  try {
    const conteudo = {
      empresa_id: dados.empresaId,
      titulo: dados.titulo || 'Nova demanda',
      tipo: dados.tipo || 'carrossel',
      status: 'rascunho',
      descricao: dados.descricao || null,
      data_publicacao: dados.dataPublicacao || null,
      mes: dados.mes || new Date().getMonth() + 1,
      ano: dados.ano || new Date().getFullYear(),
      ordem: dados.ordem || 999,
      slides: [],
      prompts_imagem: [],
      prompts_video: [],
      midia_urls: []
    };
    
    const { data, error } = await db.from('planejamento_conteudos')
      .insert([conteudo])
      .select()
      .single();
    if (error) throw error;
    showToast('Demanda criada com sucesso!', 'success');
    return data;
  } catch (err) {
    console.error('Erro ao criar conteúdo rápido:', err);
    showToast('Erro ao criar demanda', 'error');
    return null;
  }
}

// ============================================
// APROVAÇÕES
// ============================================

function gerarToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

async function criarLinkAprovacao(conteudoId, empresaId) {
  try {
    const token = gerarToken();
    const { data, error } = await db.from('aprovacoes_links')
      .insert([{
        conteudo_id: conteudoId,
        empresa_id: empresaId,
        token: token,
        status: 'pendente'
      }])
      .select()
      .single();
    if (error) throw error;
    showToast('Link de aprovação gerado!', 'success');
    return data;
  } catch (err) {
    console.error('Erro ao criar link:', err);
    showToast('Erro ao gerar link de aprovação', 'error');
    return null;
  }
}

async function getAprovacaoByToken(token) {
  try {
    const { data, error } = await db.from('aprovacoes_links')
      .select('*, planejamento_conteudos(*), empresas(*)')
      .eq('token', token)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao buscar aprovação:', err);
    return null;
  }
}

async function responderAprovacao(token, status, comentario = '', clienteNome = '') {
  try {
    const updates = {
      status: status,
      comentario_cliente: comentario,
      cliente_nome: clienteNome
    };
    if (status === 'aprovado') {
      updates.aprovado_em = new Date().toISOString();
    }
    const { data, error } = await db.from('aprovacoes_links')
      .update(updates)
      .eq('token', token)
      .select()
      .single();
    if (error) throw error;

    // Atualizar status do conteúdo se aprovado
    if (status === 'aprovado' && data.conteudo_id) {
      await atualizarConteudo(data.conteudo_id, { status: 'aprovado' });
    }

    return data;
  } catch (err) {
    console.error('Erro ao responder aprovação:', err);
    return null;
  }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || 'ℹ️'} ${message}`;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// ============================================
// UTILITÁRIOS
// ============================================

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const STATUS_CONFIG = {
  // Status antigos para retrocompatibilidade
  ideia: { emoji: '💡', label: 'Ideia', color: '#666666' },
  planejado: { emoji: '📋', label: 'Planejado', color: '#3B82F6' },
  produzindo: { emoji: '🔨', label: 'Produzindo', color: '#F59E0B' },
  pronto: { emoji: '✅', label: 'Pronto', color: '#10B981' },
  enviado: { emoji: '📤', label: 'Enviado', color: '#8B5CF6' },
  aprovado: { emoji: '👍', label: 'Aprovado', color: '#D4A017' },
  
  // Novos status do workflow Kanban
  rascunho: { emoji: '📝', label: 'Rascunho', color: '#6B7280' },
  conteudo: { emoji: '🎨', label: 'Conteúdo', color: '#10B981' },
  aprovacao_cliente: { emoji: '👁️', label: 'Aprovação do cliente', color: '#F59E0B' },
  ajustes: { emoji: '🔧', label: 'Ajustes', color: '#EAB308' },
  aguardando: { emoji: '⏳', label: 'Aguardando', color: '#F97316' },
  aprovado_agendado: { emoji: '✅', label: 'Aprovado e agendado', color: '#3B82F6' },
  concluido: { emoji: '✔️', label: 'Concluídos', color: '#22C55E' }
};

// Configuração específica para o Kanban
const KANBAN_CONFIG = [
  { key: 'rascunho', emoji: '📝', label: 'Rascunho', color: '#6B7280' },
  { key: 'conteudo', emoji: '🎨', label: 'Conteúdo', color: '#10B981' },
  { key: 'aprovacao_cliente', emoji: '👁️', label: 'Aprovação do cliente', color: '#F59E0B' },
  { key: 'ajustes', emoji: '🔧', label: 'Ajustes', color: '#EAB308' },
  { key: 'aguardando', emoji: '⏳', label: 'Aguardando', color: '#F97316' },
  { key: 'aprovado_agendado', emoji: '✅', label: 'Aprovado e agendado', color: '#3B82F6' },
  { key: 'concluido', emoji: '✔️', label: 'Concluídos', color: '#22C55E' }
];

const TIPOS = ['carrossel', 'reels', 'stories', 'estático', 'vídeo'];

const TIPO_EMOJI = {
  'carrossel': '📑',
  'reels': '🎬',
  'stories': '📱',
  'estático': '🖼️',
  'vídeo': '🎥'
};

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function getBaseUrl() {
  const loc = window.location;
  return `${loc.protocol}//${loc.host}${loc.pathname.replace(/\/[^/]*$/, '')}`;
}

// Copiar para clipboard
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copiado!', 'success');
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showToast('Copiado!', 'success');
  }
}
