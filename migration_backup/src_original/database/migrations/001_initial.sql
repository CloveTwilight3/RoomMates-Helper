-- 001_initial.sql
-- Initial database schema for The Roommates Helper bot

-- Enable foreign key support
PRAGMA foreign_keys = ON;

-- Guilds table - Core server information
CREATE TABLE guilds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon_url TEXT,
    member_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Verification system configuration
CREATE TABLE verification_config (
    guild_id TEXT PRIMARY KEY,
    mod_channel_id TEXT,
    age_unverified_role_id TEXT,
    nsfw_access_role_id TEXT,
    nsfw_no_access_role_id TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Message logger configuration
CREATE TABLE message_logger_config (
    guild_id TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE,
    log_channel_id TEXT,
    ignored_channels TEXT DEFAULT '[]', -- JSON array of channel IDs
    ignored_users TEXT DEFAULT '[]',    -- JSON array of user IDs
    log_message_content BOOLEAN DEFAULT TRUE,
    log_dms BOOLEAN DEFAULT FALSE,
    log_edits BOOLEAN DEFAULT TRUE,
    log_deletes BOOLEAN DEFAULT TRUE,
    log_joins BOOLEAN DEFAULT TRUE,
    log_leaves BOOLEAN DEFAULT TRUE,
    max_message_length INTEGER DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Moderation infractions
CREATE TABLE infractions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('WARNING', 'MUTE', 'UNMUTE', 'BAN', 'UNBAN', 'KICK', 'NOTE')),
    reason TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    active BOOLEAN DEFAULT TRUE,
    appealed BOOLEAN DEFAULT FALSE,
    appeal_id TEXT NULL,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Create index for faster queries on infractions
CREATE INDEX idx_infractions_user_guild ON infractions(user_id, guild_id);
CREATE INDEX idx_infractions_guild_type ON infractions(guild_id, type);
CREATE INDEX idx_infractions_active ON infractions(active);
CREATE INDEX idx_infractions_timestamp ON infractions(timestamp);

-- Appeals for infractions
CREATE TABLE appeals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    case_id TEXT NOT NULL, -- References infractions.id
    infraction_type TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DENIED')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewer_id TEXT NULL,
    review_reason TEXT NULL,
    review_timestamp DATETIME NULL,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES infractions(id) ON DELETE CASCADE
);

-- Create index for appeals
CREATE INDEX idx_appeals_user_guild ON appeals(user_id, guild_id);
CREATE INDEX idx_appeals_status ON appeals(status);
CREATE INDEX idx_appeals_case_id ON appeals(case_id);

-- Moderation system configuration
CREATE TABLE mod_config (
    guild_id TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT FALSE,
    moderator_role_id TEXT NULL,
    muted_role_id TEXT NULL,
    log_channel_id TEXT NULL,
    appeal_channel_id TEXT NULL,
    dm_notifications BOOLEAN DEFAULT TRUE,
    auto_delete BOOLEAN DEFAULT TRUE,
    delete_delay INTEGER DEFAULT 5000,
    warn_threshold INTEGER DEFAULT 3,
    allow_appeals BOOLEAN DEFAULT TRUE,
    appeal_cooldown INTEGER DEFAULT 24, -- hours
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE
);

-- Server statistics - daily data
CREATE TABLE server_stats_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    date DATE NOT NULL,
    channel_id TEXT NULL, -- NULL for server-wide stats
    message_count INTEGER DEFAULT 0,
    join_count INTEGER DEFAULT 0,
    leave_count INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    moderation_actions INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
    UNIQUE(guild_id, date, channel_id)
);

-- Create index for stats queries
CREATE INDEX idx_stats_guild_date ON server_stats_daily(guild_id, date);
CREATE INDEX idx_stats_date ON server_stats_daily(date);

-- Active user tracking for statistics
CREATE TABLE active_users_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    date DATE NOT NULL,
    message_count INTEGER DEFAULT 0,
    channels_active TEXT DEFAULT '[]', -- JSON array of channel IDs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
    UNIQUE(guild_id, user_id, date)
);

-- Create index for active users
CREATE INDEX idx_active_users_guild_date ON active_users_daily(guild_id, date);

-- Bot health status (replacing health.json)
CREATE TABLE bot_health (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Ensure only one row
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'starting' CHECK (status IN ('online', 'offline', 'starting', 'updating')),
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    uptime INTEGER DEFAULT 0, -- seconds
    version TEXT DEFAULT '1.0.0',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial health record
INSERT INTO bot_health (id, status) VALUES (1, 'starting');

-- Color roles configuration (for color role management)
CREATE TABLE color_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    hex_color TEXT NOT NULL,
    category TEXT DEFAULT 'Other',
    display_order INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guilds(id) ON DELETE CASCADE,
    UNIQUE(guild_id, role_id)
);

-- Create index for color roles
CREATE INDEX idx_color_roles_guild ON color_roles(guild_id);
CREATE INDEX idx_color_roles_category ON color_roles(guild_id, category);
CREATE INDEX idx_color_roles_enabled ON color_roles(enabled);

-- Command usage statistics
CREATE TABLE command_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command_name TEXT NOT NULL,
    user_id TEXT NOT NULL,
    guild_id TEXT NULL,
    channel_id TEXT NULL,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT NULL,
    execution_time_ms INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for command usage
CREATE INDEX idx_command_usage_command ON command_usage(command_name);
CREATE INDEX idx_command_usage_user ON command_usage(user_id);
CREATE INDEX idx_command_usage_guild ON command_usage(guild_id);
CREATE INDEX idx_command_usage_timestamp ON command_usage(timestamp);

-- Triggers to update timestamps automatically
CREATE TRIGGER update_guilds_timestamp 
    AFTER UPDATE ON guilds
    BEGIN
        UPDATE guilds SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER update_verification_config_timestamp 
    AFTER UPDATE ON verification_config
    BEGIN
        UPDATE verification_config SET updated_at = CURRENT_TIMESTAMP WHERE guild_id = NEW.guild_id;
    END;

CREATE TRIGGER update_message_logger_config_timestamp 
    AFTER UPDATE ON message_logger_config
    BEGIN
        UPDATE message_logger_config SET updated_at = CURRENT_TIMESTAMP WHERE guild_id = NEW.guild_id;
    END;

CREATE TRIGGER update_mod_config_timestamp 
    AFTER UPDATE ON mod_config
    BEGIN
        UPDATE mod_config SET updated_at = CURRENT_TIMESTAMP WHERE guild_id = NEW.guild_id;
    END;

-- Views for common queries

-- Active warnings view
CREATE VIEW active_warnings AS
SELECT 
    i.*,
    g.name as guild_name
FROM infractions i
JOIN guilds g ON i.guild_id = g.id
WHERE i.type = 'WARNING' AND i.active = TRUE;

-- Pending appeals view
CREATE VIEW pending_appeals AS
SELECT 
    a.*,
    i.reason as original_reason,
    i.moderator_id as original_moderator,
    g.name as guild_name
FROM appeals a
JOIN infractions i ON a.case_id = i.id
JOIN guilds g ON a.guild_id = g.id
WHERE a.status = 'PENDING';

-- User infraction summary view
CREATE VIEW user_infraction_summary AS
SELECT 
    guild_id,
    user_id,
    COUNT(*) as total_infractions,
    COUNT(CASE WHEN active = TRUE THEN 1 END) as active_infractions,
    COUNT(CASE WHEN type = 'WARNING' AND active = TRUE THEN 1 END) as active_warnings,
    COUNT(CASE WHEN type = 'MUTE' AND active = TRUE THEN 1 END) as active_mutes,
    COUNT(CASE WHEN type = 'BAN' AND active = TRUE THEN 1 END) as active_bans,
    MAX(timestamp) as last_infraction
FROM infractions
GROUP BY guild_id, user_id;

-- Command usage summary view
CREATE VIEW command_usage_summary AS
SELECT 
    command_name,
    COUNT(*) as total_uses,
    COUNT(CASE WHEN success = TRUE THEN 1 END) as successful_uses,
    COUNT(CASE WHEN success = FALSE THEN 1 END) as failed_uses,
    AVG(execution_time_ms) as avg_execution_time,
    COUNT(DISTINCT user_id) as unique_users,
    MAX(timestamp) as last_used
FROM command_usage
GROUP BY command_name;

-- Daily statistics view
CREATE VIEW daily_server_stats AS
SELECT 
    g.name as guild_name,
    s.guild_id,
    s.date,
    SUM(s.message_count) as total_messages,
    SUM(s.join_count) as total_joins,
    SUM(s.leave_count) as total_leaves,
    AVG(s.active_users) as avg_active_users,
    SUM(s.moderation_actions) as total_mod_actions
FROM server_stats_daily s
JOIN guilds g ON s.guild_id = g.id
WHERE s.channel_id IS NULL  -- Server-wide stats only
GROUP BY s.guild_id, s.date
ORDER BY s.date DESC;

-- Recent moderation actions view (last 24 hours)
CREATE VIEW recent_moderation AS
SELECT 
    i.*,
    g.name as guild_name
FROM infractions i
JOIN guilds g ON i.guild_id = g.id
WHERE i.timestamp > datetime('now', '-24 hours')
ORDER BY i.timestamp DESC;
