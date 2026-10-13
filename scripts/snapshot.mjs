import { DatabaseSync, backup } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  renameSync,
  unlinkSync,
} from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.DB_PATH || join(root, "data/heritage.db");
const backupRoot = process.env.BACKUP_DIR || join(root, "backups");
const uploads = process.env.UPLOAD_DIR || join(dirname(dbPath), "uploads");
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
function checkLock() {
  const lock = dbPath + ".pid";
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"));
    if (Number.isSafeInteger(pid) && pid > 0) {
      try {
        process.kill(pid, 0);
      } catch (e) {
        if (e.code === "ESRCH") return;
        throw e;
      }
      throw Error("Hãy dừng máy chủ trước khi phục hồi.");
    }
  }
}
async function snapshot(destination) {
  if (!existsSync(dbPath)) throw Error("Chưa có cơ sở dữ liệu để sao lưu.");
  if (existsSync(destination))
    throw Error("Thư mục đích đã tồn tại; không ghi đè bản sao lưu.");
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  mkdirSync(join(destination, "uploads"), { mode: 0o700 });
  const source = new DatabaseSync(dbPath, { readOnly: true });
  try {
    await backup(source, join(destination, "database.sqlite"));
  } finally {
    source.close();
  }
  const copy = new DatabaseSync(join(destination, "database.sqlite"), {
    readOnly: true,
  });
  const files = copy.prepare("SELECT * FROM files").all();
  copy.close();
  const manifest = {
    version: 1,
    created_at: new Date().toISOString(),
    database_sha256: sha(join(destination, "database.sqlite")),
    files: [],
  };
  for (const f of files) {
    if (!/^[a-f0-9]{32}$/.test(f.id)) throw Error("Mã tệp không hợp lệ");
    const p = join(uploads, f.id);
    if (!existsSync(p) || sha(p) !== f.sha256)
      throw Error("Tệp đính kèm thiếu hoặc sai checksum: " + f.id);
    copyFileSync(p, join(destination, "uploads", f.id));
    manifest.files.push({ id: f.id, sha256: f.sha256 });
  }
  writeFileSync(
    join(destination, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    { mode: 0o600 },
  );
  return destination;
}
try {
  const mode = process.argv[2];
  if (mode === "backup") {
    const output = resolve(
      process.argv[3] ||
        join(
          backupRoot,
          new Date().toISOString().replace(/[:.]/g, "-") +
            "-" +
            randomBytes(3).toString("hex"),
        ),
    );
    console.log("Đã sao lưu đầy đủ: " + (await snapshot(output)));
  } else if (mode === "restore") {
    if (!process.argv[3] || !process.argv.includes("--confirm"))
      throw Error(
        "Cú pháp: npm run restore -- /đường/dẫn/bản-sao --confirm (dừng máy chủ trước).",
      );
    checkLock();
    const restoreLock = dbPath + ".pid";
    if (existsSync(restoreLock)) unlinkSync(restoreLock);
    mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
    writeFileSync(restoreLock, String(process.pid), {
      flag: "wx",
      mode: 0o600,
    });
    process.on("exit", () => {
      if (
        existsSync(restoreLock) &&
        readFileSync(restoreLock, "utf8") === String(process.pid)
      )
        unlinkSync(restoreLock);
    });
    const source = resolve(process.argv[3]),
      manifest = JSON.parse(
        readFileSync(join(source, "manifest.json"), "utf8"),
      );
    if (
      manifest.version !== 1 ||
      !Array.isArray(manifest.files) ||
      sha(join(source, "database.sqlite")) !== manifest.database_sha256
    )
      throw Error("Manifest hoặc checksum cơ sở dữ liệu không hợp lệ.");
    const validation = new DatabaseSync(join(source, "database.sqlite"), {
      readOnly: true,
    });
    try {
      if (
        validation.prepare("PRAGMA integrity_check").get().integrity_check !==
        "ok"
      )
        throw Error("Cơ sở dữ liệu hỏng");
      const files = validation.prepare("SELECT * FROM files").all();
      if (files.length !== manifest.files.length)
        throw Error("Danh mục tệp không khớp");
      for (const f of files) {
        if (
          !/^[a-f0-9]{32}$/.test(f.id) ||
          !manifest.files.some((x) => x.id === f.id && x.sha256 === f.sha256) ||
          sha(join(source, "uploads", f.id)) !== f.sha256
        )
          throw Error("Tệp sai checksum: " + f.id);
      }
    } finally {
      validation.close();
    }
    const safety = join(
      backupRoot,
      "before-restore-" + Date.now() + "-" + randomBytes(3).toString("hex"),
    );
    if (existsSync(dbPath)) await snapshot(safety);
    mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
    mkdirSync(uploads, { recursive: true, mode: 0o700 });
    for (const f of manifest.files) {
      const target = join(uploads, f.id);
      if (existsSync(target) && sha(target) !== f.sha256)
        throw Error("Tệp hiện có xung đột; không ghi đè: " + f.id);
      if (!existsSync(target))
        copyFileSync(join(source, "uploads", f.id), target);
    }
    const staged = dbPath + ".restore-" + randomBytes(4).toString("hex");
    copyFileSync(join(source, "database.sqlite"), staged);
    for (const suffix of ["-wal", "-shm"])
      if (existsSync(dbPath + suffix))
        renameSync(dbPath + suffix, dbPath + suffix + ".before-" + Date.now());
    renameSync(staged, dbPath);
    console.log(
      "Đã phục hồi. Bản sao dữ liệu trước phục hồi (nếu có): " + safety,
    );
  } else throw Error("Chọn backup hoặc restore.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
