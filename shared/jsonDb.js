// A tiny NoSQL "database" that stores a collection of documents in a JSON file.
// Each service creates its own JsonDb instance pointing to its own file.

const fs = require('fs/promises');
const path = require('path');

class JsonDb {
  constructor(filePath) {
    this.filePath = filePath;
    // All writes go through this promise chain so two requests can never
    // write the file at the same time and corrupt it.
    this.queue = Promise.resolve();
  }

  // Read the whole file and return the array of documents.
  async readAll() {
    try {
      const text = await fs.readFile(this.filePath, 'utf8');
      const data = JSON.parse(text);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File does not exist yet: start with an empty collection.
        await this.#save([]);
        return [];
      }
      throw new Error(`Database file is unreadable: ${path.basename(this.filePath)}`);
    }
  }

  async findById(id) {
    const items = await this.readAll();
    return items.find((item) => item.id === id) || null;
  }

  // Run a change against the data and save it, one change at a time.
  // `changeFn` receives the array, may modify it, and returns a result.
  update(changeFn) {
    const run = this.queue.then(async () => {
      const items = await this.readAll();
      const result = await changeFn(items);
      await this.#save(items);
      return result;
    });
    // Keep the queue alive even if this change fails.
    this.queue = run.catch(() => {});
    return run;
  }

  // Next id = highest existing id + 1.
  static nextId(items) {
    return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  }

  // Write to a temporary file first, then rename it over the real file.
  // Rename is atomic, so a crash mid-write never leaves a half-written file.
  async #save(items) {
    const tmp = `${this.filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(items, null, 2));
    await fs.rename(tmp, this.filePath);
  }
}

module.exports = JsonDb;
