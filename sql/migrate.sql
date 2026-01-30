CREATE TABLE IF NOT EXISTS empresas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome varchar(255) NOT NULL,
  slug varchar(100) UNIQUE NOT NULL,
  cores jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS planejamento_conteudos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  mes int NOT NULL,
  ano int NOT NULL,
  data_publicacao date,
  titulo varchar(500),
  tipo varchar(50) DEFAULT 'carrossel',
  badge varchar(255),
  descricao text,
  slides jsonb DEFAULT '[]'::jsonb,
  prompts_imagem jsonb DEFAULT '[]'::jsonb,
  prompts_video jsonb DEFAULT '[]'::jsonb,
  legenda text,
  status varchar(50) DEFAULT 'rascunho',
  ordem int DEFAULT 1,
  midia_urls jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aprovacoes_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conteudo_id uuid REFERENCES planejamento_conteudos(id) ON DELETE CASCADE,
  token varchar(64) UNIQUE NOT NULL,
  empresa_id uuid REFERENCES empresas(id) ON DELETE CASCADE,
  status varchar(20) DEFAULT 'pendente',
  comentario_cliente text,
  cliente_nome varchar(255),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  aprovado_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_conteudos_empresa ON planejamento_conteudos(empresa_id, mes, ano);
CREATE INDEX IF NOT EXISTS idx_aprovacoes_token ON aprovacoes_links(token);

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_total_empresas" ON empresas;
CREATE POLICY "acesso_total_empresas" ON empresas FOR ALL USING (true);

ALTER TABLE planejamento_conteudos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_total_conteudos" ON planejamento_conteudos;
CREATE POLICY "acesso_total_conteudos" ON planejamento_conteudos FOR ALL USING (true);

ALTER TABLE aprovacoes_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acesso_total_aprovacoes" ON aprovacoes_links;
CREATE POLICY "acesso_total_aprovacoes" ON aprovacoes_links FOR ALL USING (true);
