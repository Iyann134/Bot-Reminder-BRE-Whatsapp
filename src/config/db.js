import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = path.resolve(process.cwd(), 'db.json');
const dbTmpPath = dbPath + '.tmp';

// ─── Local DB Read Cache (TTL: 500ms) ───────────────────────
// Prevents repeated disk reads within the same operation tick
let _dbCache = null;
let _dbCacheAt = 0;
const DB_CACHE_TTL_MS = 500;

function getCachedDb() {
  const now = Date.now();
  if (_dbCache && (now - _dbCacheAt) < DB_CACHE_TTL_MS) {
    return _dbCache;
  }
  return null;
}

function setCachedDb(data) {
  _dbCache = data;
  _dbCacheAt = Date.now();
}

function invalidateCache() {
  _dbCache = null;
  _dbCacheAt = 0;
}

// ─── Initialize db.json if missing or corrupted ─────────────
function initLocalDb() {
  if (!fs.existsSync(dbPath)) {
    writeLocalDb({ schedules: [], tasks: [] });
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      if (!data.schedules || !data.tasks) {
        writeLocalDb({
          schedules: data.schedules || [],
          tasks: data.tasks || []
        });
      }
    } catch {
      writeLocalDb({ schedules: [], tasks: [] });
    }
  }
}

initLocalDb();

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
export const supabase = hasSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null;

console.log(hasSupabase ? '⚡ Supabase Cloud Database Connected.' : '💾 Using Local JSON Database (db.json).');

// ─── Local JSON DB Helpers ───────────────────────────────────

function readLocalDb() {
  const cached = getCachedDb();
  if (cached) return cached;

  initLocalDb();
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  setCachedDb(data);
  return data;
}

/**
 * Atomic write: write to .tmp first, then rename.
 * Prevents data corruption if the process is interrupted mid-write.
 */
function writeLocalDb(data) {
  const serialized = JSON.stringify(data, null, 2);
  fs.writeFileSync(dbTmpPath, serialized, 'utf8');
  fs.renameSync(dbTmpPath, dbPath);
  setCachedDb(data); // update cache after write
}

// ─── Data Operations (Unified Supabase / Local Dual-Mode) ────

export const db = {
  // Schedules
  async getSchedules(userPhone) {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('user_phone', userPhone)
        .order('id', { ascending: true });
      if (error) throw error;
      return data || [];
    } else {
      const local = readLocalDb();
      return (local.schedules || []).filter(s => s.user_phone === userPhone);
    }
  },

  async addSchedule(scheduleObj) {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('schedules')
        .insert([scheduleObj])
        .select();
      if (error) throw error;
      return data[0];
    } else {
      const local = readLocalDb();
      const newId = (local.schedules.reduce((max, item) => (item.id > max ? item.id : max), 0) || 0) + 1;
      const newItem = { id: newId, ...scheduleObj, created_at: new Date().toISOString() };
      local.schedules.push(newItem);
      invalidateCache();
      writeLocalDb(local);
      return newItem;
    }
  },

  async deleteSchedule(userPhone, scheduleId) {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('schedules')
        .delete()
        .eq('user_phone', userPhone)
        .eq('id', scheduleId)
        .select();
      if (error) throw error;
      return data && data.length > 0;
    } else {
      const local = readLocalDb();
      const initialLen = local.schedules.length;
      local.schedules = local.schedules.filter(
        s => !(s.user_phone === userPhone && Number(s.id) === Number(scheduleId))
      );
      invalidateCache();
      writeLocalDb(local);
      return local.schedules.length < initialLen;
    }
  },

  // Tasks
  async getTasks(userPhone) {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_phone', userPhone)
        .order('id', { ascending: true });
      if (error) throw error;
      return data || [];
    } else {
      const local = readLocalDb();
      return (local.tasks || []).filter(t => t.user_phone === userPhone);
    }
  },

  async addTask(taskObj) {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskObj])
        .select();
      if (error) throw error;
      return data[0];
    } else {
      const local = readLocalDb();
      const newId = (local.tasks.reduce((max, item) => (item.id > max ? item.id : max), 0) || 0) + 1;
      const newItem = { id: newId, ...taskObj, created_at: new Date().toISOString() };
      local.tasks.push(newItem);
      invalidateCache();
      writeLocalDb(local);
      return newItem;
    }
  },

  async updateTaskStatus(userPhone, taskId, status) {
    return await this.updateTaskDetails(userPhone, taskId, { status });
  },

  async updateTaskDetails(userPhone, taskId, updateFields) {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('tasks')
        .update(updateFields)
        .eq('user_phone', userPhone)
        .eq('id', taskId)
        .select();
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    } else {
      const local = readLocalDb();
      let updatedItem = null;
      local.tasks = local.tasks.map(t => {
        if (t.user_phone === userPhone && Number(t.id) === Number(taskId)) {
          updatedItem = { ...t, ...updateFields };
          return updatedItem;
        }
        return t;
      });
      if (updatedItem) {
        invalidateCache();
        writeLocalDb(local);
      }
      return updatedItem;
    }
  },

  async updateScheduleDetails(userPhone, scheduleId, updateFields) {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('schedules')
        .update(updateFields)
        .eq('user_phone', userPhone)
        .eq('id', scheduleId)
        .select();
      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    } else {
      const local = readLocalDb();
      let updatedItem = null;
      local.schedules = local.schedules.map(s => {
        if (s.user_phone === userPhone && Number(s.id) === Number(scheduleId)) {
          updatedItem = { ...s, ...updateFields };
          return updatedItem;
        }
        return s;
      });
      if (updatedItem) {
        invalidateCache();
        writeLocalDb(local);
      }
      return updatedItem;
    }
  },

  async deleteTask(userPhone, taskId) {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('tasks')
        .delete()
        .eq('user_phone', userPhone)
        .eq('id', taskId)
        .select();
      if (error) throw error;
      return data && data.length > 0;
    } else {
      const local = readLocalDb();
      const initialLen = local.tasks.length;
      local.tasks = local.tasks.filter(
        t => !(t.user_phone === userPhone && Number(t.id) === Number(taskId))
      );
      invalidateCache();
      writeLocalDb(local);
      return local.tasks.length < initialLen;
    }
  },

  // Reminders (across all users)
  async getAllPendingTasks() {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'pending');
      if (error) throw error;
      return data || [];
    } else {
      const local = readLocalDb();
      return (local.tasks || []).filter(t => t.status === 'pending');
    }
  },

  async getAllSchedules() {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('schedules')
        .select('*');
      if (error) throw error;
      return data || [];
    } else {
      const local = readLocalDb();
      return local.schedules || [];
    }
  }
};
