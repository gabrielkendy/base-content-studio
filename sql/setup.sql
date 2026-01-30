-- ============================================
-- BASE Content Studio - Setup SQL
-- Executar no Supabase SQL Editor
-- ============================================

-- 1. Inserir novas empresas
INSERT INTO empresas (nome, slug, cores) VALUES
  ('Manchester', 'manchester', '{"primaria": "#C41E3A", "secundaria": "#C9A227"}'),
  ('Nechio', 'nechio', '{"primaria": "#6366F1", "secundaria": "#818CF8"}'),
  ('FlexByo', 'flexbyo', '{"primaria": "#10B981", "secundaria": "#34D399"}'),
  ('Just Burn', 'justburn', '{"primaria": "#F59E0B", "secundaria": "#FBBF24"}'),
  ('RT', 'rt', '{"primaria": "#EF4444", "secundaria": "#F87171"}')
ON CONFLICT (slug) DO NOTHING;

-- 2. Adicionar coluna midia_urls se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'planejamento_conteudos' AND column_name = 'midia_urls'
  ) THEN
    ALTER TABLE planejamento_conteudos ADD COLUMN midia_urls jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 3. Criar tabela aprovacoes_links
CREATE TABLE IF NOT EXISTS aprovacoes_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conteudo_id uuid REFERENCES planejamento_conteudos(id) ON DELETE CASCADE,
  token varchar(64) UNIQUE NOT NULL,
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  status varchar(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'ajuste')),
  comentario_cliente text,
  cliente_nome varchar(255),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  aprovado_em timestamptz
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_aprovacoes_links_token ON aprovacoes_links(token);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_links_conteudo ON aprovacoes_links(conteudo_id);
CREATE INDEX IF NOT EXISTS idx_planejamento_empresa_mes ON planejamento_conteudos(empresa_id, mes, ano);

-- 5. RLS (Row Level Security) - permitir acesso anon para aprovações
ALTER TABLE aprovacoes_links ENABLE ROW LEVEL SECURITY;

-- Política para leitura pública (via token)
DROP POLICY IF EXISTS "Leitura pública por token" ON aprovacoes_links;
CREATE POLICY "Leitura pública por token" ON aprovacoes_links
  FOR SELECT USING (true);

-- Política para inserção (dashboard)
DROP POLICY IF EXISTS "Inserção via dashboard" ON aprovacoes_links;
CREATE POLICY "Inserção via dashboard" ON aprovacoes_links
  FOR INSERT WITH CHECK (true);

-- Política para atualização (aprovação do cliente)
DROP POLICY IF EXISTS "Atualização via aprovação" ON aprovacoes_links;
CREATE POLICY "Atualização via aprovação" ON aprovacoes_links
  FOR UPDATE USING (true);

-- Garantir RLS nas outras tabelas permite leitura
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Leitura pública empresas" ON empresas;
CREATE POLICY "Leitura pública empresas" ON empresas FOR SELECT USING (true);
DROP POLICY IF EXISTS "Escrita empresas" ON empresas;
CREATE POLICY "Escrita empresas" ON empresas FOR ALL USING (true);

ALTER TABLE planejamento_conteudos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acesso total conteudos" ON planejamento_conteudos;
CREATE POLICY "Acesso total conteudos" ON planejamento_conteudos FOR ALL USING (true);
