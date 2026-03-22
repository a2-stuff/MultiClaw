import yauzl from "yauzl";
import fs from "fs";
import path from "path";

const MAX_EXTRACTED_SIZE = 50 * 1024 * 1024; // 50MB

interface ExtractedFile {
  originalname: string;
  diskPath: string;
}

export function extractZip(zipBuffer: Buffer, destDir: string): Promise<ExtractedFile[]> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(destDir, { recursive: true });
    yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      const files: ExtractedFile[] = [];
      let totalSize = 0;

      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        const fileName = entry.fileName;

        // Path traversal protection
        if (fileName.includes("..") || path.isAbsolute(fileName)) {
          return reject(new Error(`Unsafe path in ZIP: ${fileName}`));
        }

        // Skip directories
        if (fileName.endsWith("/")) {
          zipfile.readEntry();
          return;
        }

        totalSize += entry.uncompressedSize;
        if (totalSize > MAX_EXTRACTED_SIZE) {
          return reject(new Error("ZIP contents exceed 50MB limit"));
        }

        const fullPath = path.join(destDir, fileName);
        const resolved = path.resolve(destDir, fileName);
        if (!resolved.startsWith(path.resolve(destDir) + path.sep)) {
          throw new Error(`Zip entry attempts path traversal: ${fileName}`);
        }
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });

        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) return reject(err);
          const writeStream = fs.createWriteStream(fullPath);
          readStream.pipe(writeStream);
          writeStream.on("close", () => {
            files.push({ originalname: fileName, diskPath: fullPath });
            zipfile.readEntry();
          });
          writeStream.on("error", reject);
        });
      });

      zipfile.on("end", () => resolve(files));
      zipfile.on("error", reject);
    });
  });
}
