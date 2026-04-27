import fs from "node:fs";
import path from "node:path";
import lockfile from "proper-lockfile";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

import { DATA_DIR } from "@/lib/dataDir.js";

const isCloud = typeof caches !== "undefined" || typeof caches === "object";
const DB_FILE = isCloud ? null : path.join(DATA_DIR, "otp-challenges.json");
const LOCK_OPTIONS = {
  retries: { retries: 15, minTimeout: 50, maxTimeout: 3000 },
  stale: 10000,
};

function defaultData() {
  return { challenges: [] };
}

if (!isCloud && !fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!isCloud && DB_FILE && !fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(defaultData(), null, 2));
}

let dbInstance = null;

class LocalMutex {
  constructor() {
    this.locked = false;
    this.queue = [];
  }

  async acquire() {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }

    return new Promise((resolve) => {
      this.queue.push(() => resolve(() => this.release()));
    });
  }

  release() {
    const next = this.queue.shift();
    if (next) {
      next();
      return;
    }

    this.locked = false;
  }
}

const mutex = new LocalMutex();

async function withLock(callback) {
  if (isCloud) {
    await callback();
    return;
  }

  const releaseLocal = await mutex.acquire();
  let releaseFile = null;
  try {
    releaseFile = await lockfile.lock(DB_FILE, LOCK_OPTIONS);
    await callback();
  } finally {
    if (releaseFile) {
      try {
        await releaseFile();
      } catch {
        // Ignore release failures.
      }
    }
    releaseLocal();
  }
}

async function getDb() {
  if (isCloud) {
    if (!dbInstance) {
      dbInstance = new Low({ read: async () => {}, write: async () => {} }, defaultData());
      dbInstance.data = defaultData();
    }
    return dbInstance;
  }

  if (!dbInstance) {
    dbInstance = new Low(new JSONFile(DB_FILE), defaultData());
  }

  await withLock(async () => {
    await dbInstance.read();
    if (!dbInstance.data || !Array.isArray(dbInstance.data.challenges)) {
      dbInstance.data = defaultData();
      await dbInstance.write();
    }
  });

  return dbInstance;
}

async function persist(mutator) {
  const db = await getDb();
  await withLock(async () => {
    await db.read();
    if (!db.data || !Array.isArray(db.data.challenges)) {
      db.data = defaultData();
    }

    mutator(db.data);
    await db.write();
  });
}

function isExpired(challenge, now = Date.now()) {
  return new Date(challenge?.expiresAt || 0).getTime() <= now;
}

export async function saveOtpChallenge(challenge) {
  await persist((data) => {
    const now = Date.now();
    data.challenges = (data.challenges || []).filter((entry) => !isExpired(entry, now) && entry.challengeId !== challenge.challengeId);
    data.challenges.push(challenge);
  });
}

export async function getOtpChallenge(challengeId) {
  const db = await getDb();
  const now = Date.now();
  let challenge = null;

  await withLock(async () => {
    await db.read();
    if (!db.data || !Array.isArray(db.data.challenges)) {
      db.data = defaultData();
    }

    const nextChallenges = db.data.challenges.filter((entry) => !isExpired(entry, now));
    if (nextChallenges.length !== db.data.challenges.length) {
      db.data.challenges = nextChallenges;
      await db.write();
    }

    challenge = db.data.challenges.find((entry) => entry.challengeId === challengeId) || null;
  });

  return challenge;
}

export async function deleteOtpChallenge(challengeId) {
  await persist((data) => {
    data.challenges = (data.challenges || []).filter((entry) => entry.challengeId !== challengeId);
  });
}
