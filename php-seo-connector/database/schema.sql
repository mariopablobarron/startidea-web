CREATE TABLE IF NOT EXISTS google_connections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  google_subject VARCHAR(191) NULL,
  email VARCHAR(191) NULL,
  scopes TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  token_created_at DATETIME NULL,
  connected_at DATETIME NOT NULL,
  disconnected_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_google_connections_active (disconnected_at),
  INDEX idx_google_connections_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_properties (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type ENUM('ga4', 'gsc') NOT NULL,
  property_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_seo_properties_type_property (type, property_id),
  INDEX idx_seo_properties_active (type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ga4_daily_metrics (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id VARCHAR(64) NOT NULL,
  metric_date DATE NOT NULL,
  page_path VARCHAR(2048) NOT NULL,
  active_users INT UNSIGNED NOT NULL DEFAULT 0,
  sessions INT UNSIGNED NOT NULL DEFAULT 0,
  screen_page_views INT UNSIGNED NOT NULL DEFAULT 0,
  event_count INT UNSIGNED NOT NULL DEFAULT 0,
  conversions DECIMAL(14,4) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ga4_daily (property_id, metric_date, page_path(512)),
  INDEX idx_ga4_property_date (property_id, metric_date),
  INDEX idx_ga4_page (page_path(512))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gsc_daily_queries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_url VARCHAR(255) NOT NULL,
  metric_date DATE NOT NULL,
  query VARCHAR(1024) NOT NULL,
  page_url VARCHAR(2048) NOT NULL,
  country VARCHAR(16) NOT NULL DEFAULT '',
  device VARCHAR(32) NOT NULL DEFAULT '',
  clicks INT UNSIGNED NOT NULL DEFAULT 0,
  impressions INT UNSIGNED NOT NULL DEFAULT 0,
  ctr DECIMAL(12,8) NOT NULL DEFAULT 0,
  position DECIMAL(8,3) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gsc_query_daily (site_url, metric_date, query(255), page_url(512), country, device),
  INDEX idx_gsc_query_site_date (site_url, metric_date),
  INDEX idx_gsc_query_position (site_url, position),
  INDEX idx_gsc_query_text (query(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gsc_daily_pages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_url VARCHAR(255) NOT NULL,
  metric_date DATE NOT NULL,
  page_url VARCHAR(2048) NOT NULL,
  country VARCHAR(16) NOT NULL DEFAULT '',
  device VARCHAR(32) NOT NULL DEFAULT '',
  clicks INT UNSIGNED NOT NULL DEFAULT 0,
  impressions INT UNSIGNED NOT NULL DEFAULT 0,
  ctr DECIMAL(12,8) NOT NULL DEFAULT 0,
  position DECIMAL(8,3) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gsc_page_daily (site_url, metric_date, page_url(512), country, device),
  INDEX idx_gsc_page_site_date (site_url, metric_date),
  INDEX idx_gsc_page_position (site_url, position),
  INDEX idx_gsc_page_url (page_url(512))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_agent_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_url VARCHAR(255) NULL,
  ga4_property_id VARCHAR(64) NULL,
  status ENUM('running', 'completed', 'failed') NOT NULL DEFAULT 'running',
  opportunities_count INT UNSIGNED NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_seo_runs_started (started_at),
  INDEX idx_seo_runs_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seo_opportunities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  run_id BIGINT UNSIGNED NULL,
  type VARCHAR(80) NOT NULL,
  priority TINYINT UNSIGNED NOT NULL DEFAULT 3,
  site_url VARCHAR(255) NULL,
  page_url VARCHAR(2048) NULL,
  keyword VARCHAR(1024) NULL,
  metric_name VARCHAR(80) NOT NULL,
  metric_value VARCHAR(80) NOT NULL,
  evidence TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  status ENUM('open', 'in_progress', 'done', 'dismissed') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_seo_opportunities_priority (priority, created_at),
  INDEX idx_seo_opportunities_type (type),
  INDEX idx_seo_opportunities_url (page_url(512)),
  INDEX idx_seo_opportunities_keyword (keyword(255)),
  CONSTRAINT fk_seo_opportunities_run
    FOREIGN KEY (run_id) REFERENCES seo_agent_runs(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
