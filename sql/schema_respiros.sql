-- Onda respiratoria ao vivo do AGROSENSE: 1 linha por RESPIRO (cerca de 12 por minuto).
-- Guarda o trecho real do sinal do sensor (em mg) para o site desenhar a onda.
-- Os dados antigos sao apagados automaticamente pela API (mantem ~30 min).
-- Rode UMA vez no banco. Nao altera nem apaga nenhuma outra tabela.
CREATE TABLE IF NOT EXISTS agrosense_respiros (
  id          BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  animal_id   VARCHAR(32)       NOT NULL,
  criado_em   TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  uptime_s    INT UNSIGNED      NULL,
  periodo_ms  SMALLINT UNSIGNED NOT NULL,   -- duracao do respiro
  amp_mg      SMALLINT UNSIGNED NOT NULL,   -- vai-e-volta do sinal, em mg
  amostras    VARCHAR(400)      NOT NULL,   -- sinal em mg separado por virgula (5 amostras/s)
  PRIMARY KEY (id),
  KEY idx_animal_id (animal_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
