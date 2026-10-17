-- Tabela propria do projeto AGROSENSE (o banco e compartilhado com outros alunos).
-- Uma linha por minuto, com todos os sinais do animal. Rode UMA vez no banco.
-- Nao altera nem apaga nenhuma outra tabela.
CREATE TABLE IF NOT EXISTS agrosense_leituras (
  id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  animal_id              VARCHAR(32)     NOT NULL,
  criado_em              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uptime_s               INT UNSIGNED    NULL,

  temperatura_c          DECIMAL(4,1)    NULL,
  temperatura_nivel      VARCHAR(12)     NULL,

  bpm                    SMALLINT UNSIGNED NULL,
  bpm_nivel              VARCHAR(12)     NULL,

  resp_rpm               DECIMAL(5,1)    NULL,
  resp_qualidade         DECIMAL(4,2)    NULL,
  resp_nivel             VARCHAR(12)     NULL,
  resp_motivo            VARCHAR(80)     NULL,

  movimento_estado       VARCHAR(16)     NULL,
  movimento_intensidade  DECIMAL(6,3)    NULL,

  latitude               DECIMAL(9,6)    NULL,
  longitude              DECIMAL(9,6)    NULL,

  PRIMARY KEY (id),
  KEY idx_animal_id (animal_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
