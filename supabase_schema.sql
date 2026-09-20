-- BRE Personal Secretary & Operations Agent - Supabase Database Schema

-- 1. Schedules Table
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(50) NOT NULL,
    day VARCHAR(20) NOT NULL,
    time VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    location VARCHAR(255) DEFAULT 'Online / TBD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on user_phone for fast multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_schedules_user_phone ON schedules(user_phone);

-- 2. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    deadline_text VARCHAR(255),
    deadline_datetime TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index on user_phone and status
CREATE INDEX IF NOT EXISTS idx_tasks_user_phone ON tasks(user_phone);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
