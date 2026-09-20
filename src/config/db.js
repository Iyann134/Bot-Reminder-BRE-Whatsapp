import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = path.resolve(process.cwd(), 'db.json');

// Initialize db.json if missing or corrupted
function initLocalDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ schedules: [], tasks: [] }, null, 2));
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      if (!data.schedules || !data.tasks) {
        fs.writeFileSync(dbPath, JSON.stringify({ schedules: data.schedules || [], tasks: data.tasks || [] }, null, 2));
      }
    } catch {
      fs.writeFileSync(dbPath, JSON.stringify({ schedules: [], tasks: [] }, null, 2));
    }
  }
}

initLocalDb();

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
export const supabase = hasSupabase
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  : null;

console.log(hasSupabase ? '⚡ Supabase Cloud Database Connected.' : '💾 Using Local JSON Database (db.json).');

// --- Local JSON DB Helpers ---
function readLocalDb() {
  initLocalDb();
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeLocalDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// --- Data Operations (Unified Supabase / Local Dual-Mode) ---

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
      local.schedules = local.schedules.filter(s => !(s.user_phone === userPhone && Number(s.id) === Number(scheduleId)));
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
      writeLocalDb(local);
      return newItem;
    }
  },

  async updateTaskStatus(userPhone, taskId, status) {
    if (hasSupabase) {
      const { data, error } = await supabase
        .from('tasks')
        .update({ status })
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
          updatedItem = { ...t, status };
          return updatedItem;
        }
        return t;
      });
      if (updatedItem) writeLocalDb(local);
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
      local.tasks = local.tasks.filter(t => !(t.user_phone === userPhone && Number(t.id) === Number(taskId)));
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
